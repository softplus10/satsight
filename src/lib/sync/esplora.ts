import { t } from '$lib/i18n';
import { deriveAddress } from '$lib/domain/bitcoin';
import { normalizeGapLimit } from '$lib/domain/address-pool';
import type { AppSettings, Wallet, WalletTransaction, WatchedAddress } from '$lib/domain/types';

interface AddressStats {
	chain_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number };
	mempool_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number };
}

interface EsploraTransaction {
	txid: string;
	fee: number;
	vin: { prevout?: { scriptpubkey_address?: string; value: number } }[];
	vout: { scriptpubkey_address?: string; value: number }[];
	status: { confirmed: boolean; block_height?: number; block_time?: number };
}

export interface SyncResult {
	wallet: Wallet;
	addresses: WatchedAddress[];
	transactions: WalletTransaction[];
}

export function esploraApiBase(settings: AppSettings, wallet: Wallet) {
	const base = settings.apiUrl.trim().replace(/\/$/, '');
	if (wallet.network === 'testnet' && /^https:\/\/blockstream\.info\/api$/i.test(base)) {
		return 'https://blockstream.info/testnet/api';
	}
	return base;
}

async function fetchJson<T>(url: string): Promise<T> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 15_000);
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { Accept: 'application/json' }
		});
		if (!response.ok) throw new Error(t('sync_server_error', { status: response.status }));
		return (await response.json()) as T;
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw new Error(t('sync_timeout'));
		}
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}

async function scanAddress(
	base: string,
	wallet: Wallet,
	branch: 0 | 1,
	index: number,
	known?: WatchedAddress
): Promise<WatchedAddress> {
	const address =
		wallet.kind === 'address'
			? wallet.source
			: deriveAddress(wallet.source, wallet.network, wallet.scriptType, branch, index);
	const stats = await fetchJson<AddressStats>(`${base}/address/${address}`);
	const confirmed = stats.chain_stats.funded_txo_sum - stats.chain_stats.spent_txo_sum;
	const mempool = stats.mempool_stats.funded_txo_sum - stats.mempool_stats.spent_txo_sum;
	const txCount = stats.chain_stats.tx_count + stats.mempool_stats.tx_count;
	return {
		id: `${wallet.id}:${branch}:${index}`,
		walletId: wallet.id,
		address,
		branch,
		index,
		label: known?.label ?? '',
		used: txCount > 0,
		balance: confirmed + mempool,
		confirmedBalance: confirmed,
		txCount
	};
}

async function scanBranch(
	base: string,
	wallet: Wallet,
	branch: 0 | 1,
	gapLimit: number,
	known: Map<string, WatchedAddress>
) {
	const found: WatchedAddress[] = [];
	let unused = 0;
	let index = 0;
	// Every address exposed in the paginated list must remain watched, even if
	// there is an unused gap before it. Continue discovery beyond that range
	// until a complete unused window follows the latest activity.
	let knownEnd = 0;
	for (const item of known.values()) {
		if (item.branch === branch) knownEnd = Math.max(knownEnd, item.index + 1);
	}

	while (index < knownEnd || unused < gapLimit) {
		const batchSize = Math.min(5, Math.max(knownEnd - index, gapLimit - unused));
		const indexes = Array.from({ length: batchSize }, (_, offset) => index + offset);
		const batch = await Promise.all(
			indexes.map((current) =>
				scanAddress(base, wallet, branch, current, known.get(`${branch}:${current}`))
			)
		);
		for (const address of batch) {
			found.push(address);
			// A used address resets the consecutive-unused window for this branch.
			unused = address.used ? 0 : unused + 1;
			index += 1;
			if (index >= knownEnd && unused >= gapLimit) break;
		}
	}
	return found;
}

async function addressTransactions(base: string, address: string) {
	const transactions: EsploraTransaction[] = [];
	let path = `${base}/address/${address}/txs`;
	for (let page = 0; page < 20; page += 1) {
		const chunk = await fetchJson<EsploraTransaction[]>(path);
		transactions.push(...chunk);
		if (chunk.length < 25) break;
		path = `${base}/address/${address}/txs/chain/${chunk.at(-1)?.txid}`;
	}
	return transactions;
}

function mapTransaction(
	wallet: Wallet,
	transaction: EsploraTransaction,
	watched: Set<string>,
	now: number
): WalletTransaction {
	let spent = 0;
	let received = 0;
	const involved = new Set<string>();
	for (const input of transaction.vin) {
		const address = input.prevout?.scriptpubkey_address;
		if (address && watched.has(address)) {
			spent += input.prevout?.value ?? 0;
			involved.add(address);
		}
	}
	for (const output of transaction.vout) {
		const address = output.scriptpubkey_address;
		if (address && watched.has(address)) {
			received += output.value;
			involved.add(address);
		}
	}
	const value = received - spent;
	return {
		id: `${wallet.id}:${transaction.txid}`,
		walletId: wallet.id,
		txid: transaction.txid,
		direction: value > 0 ? 'received' : value < 0 ? 'sent' : 'self',
		value,
		fee: transaction.fee,
		status: transaction.status.confirmed ? 'confirmed' : 'pending',
		blockHeight: transaction.status.block_height,
		blockTime: transaction.status.block_time,
		firstSeen: transaction.status.block_time ?? now,
		note: '',
		addresses: [...involved]
	};
}

export async function syncWatchWallet(
	wallet: Wallet,
	knownAddresses: WatchedAddress[],
	settings: AppSettings
): Promise<SyncResult> {
	if (!navigator.onLine) throw new Error(t('sync_requires_network'));
	const base = esploraApiBase(settings, wallet);
	if (!/^https?:\/\//.test(base)) throw new Error(t('invalid_api_url'));
	const known = new Map(knownAddresses.map((item) => [`${item.branch}:${item.index}`, item]));
	const gapLimit = normalizeGapLimit(settings.gapLimit);
	const addresses =
		wallet.kind === 'address'
			? [await scanAddress(base, wallet, 0, 0, knownAddresses[0])]
			: [
					...(await scanBranch(base, wallet, 0, gapLimit, known)),
					...(await scanBranch(base, wallet, 1, gapLimit, known))
				];

	const used = addresses.filter((address) => address.used);
	const transactionLists = await Promise.all(
		used.map((address) => addressTransactions(base, address.address))
	);
	const unique = new Map(
		// A wallet transaction may appear in several receive/change address histories.
		transactionLists.flat().map((transaction) => [transaction.txid, transaction])
	);
	const watched = new Set(addresses.map((address) => address.address));
	const now = Math.floor(Date.now() / 1000);
	const transactions = [...unique.values()].map((transaction) =>
		mapTransaction(wallet, transaction, watched, now)
	);
	const balance = addresses.reduce((sum, address) => sum + address.balance, 0);
	const confirmedBalance = addresses.reduce(
		(sum, address) => sum + (address.confirmedBalance ?? address.balance),
		0
	);
	const syncedAt = new Date().toISOString();
	return {
		wallet: {
			...wallet,
			balance,
			confirmedBalance,
			txCount: transactions.length,
			updatedAt: syncedAt,
			lastSyncedAt: syncedAt,
			syncError: undefined
		},
		addresses,
		transactions
	};
}

/** Verify an unused receive address against Esplora before presenting it for payment. */
export async function findUnusedReceiveAddress(
	wallet: Wallet,
	knownAddresses: WatchedAddress[],
	settings: AppSettings
): Promise<{ address: WatchedAddress; scannedAddresses: WatchedAddress[] }> {
	if (!navigator.onLine) throw new Error(t('receive_requires_network'));
	const base = esploraApiBase(settings, wallet);
	if (!/^https?:\/\//.test(base)) throw new Error(t('invalid_api_url'));
	const receive = knownAddresses.filter((item) => item.walletId === wallet.id && item.branch === 0);
	if (
		wallet.kind === 'address' &&
		(wallet.txCount > 0 || receive.some((item) => item.used || item.txCount > 0))
	) {
		throw new Error(t('single_address_already_used'));
	}
	// Skip all previously used indexes rather than filling gaps between old payments.
	let index =
		wallet.kind === 'address'
			? 0
			: receive.reduce(
					(last, item) =>
						item.used || item.txCount > 0 || item.balance > 0 ? Math.max(last, item.index) : last,
					-1
				) + 1;
	const scannedAddresses: WatchedAddress[] = [];
	for (let attempt = 0; attempt < 50; attempt += 1) {
		const address = await scanAddress(
			base,
			wallet,
			0,
			index,
			receive.find((item) => item.index === index)
		);
		scannedAddresses.push(address);
		// A local unused flag alone is insufficient: check both confirmed and mempool activity.
		if (address.txCount === 0 && address.balance === 0 && address.confirmedBalance === 0) {
			return { address, scannedAddresses };
		}
		if (wallet.kind === 'address') throw new Error(t('single_address_already_used'));
		index += 1;
	}
	throw new Error(t('receive_scan_limit'));
}
