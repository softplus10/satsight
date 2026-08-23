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

function apiBase(settings: AppSettings, wallet: Wallet) {
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
		if (!response.ok) throw new Error(`동기화 서버 오류 (${response.status})`);
		return (await response.json()) as T;
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw new Error('동기화 서버 응답 시간이 초과되었습니다.');
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
		label: known?.label ?? (branch === 0 ? `주소 #${index + 1}` : `거스름 #${index + 1}`),
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
	const maximum = 200;

	while (unused < gapLimit && index < maximum) {
		const batchSize = Math.min(5, maximum - index);
		const indexes = Array.from({ length: batchSize }, (_, offset) => index + offset);
		const batch = await Promise.all(
			indexes.map((current) =>
				scanAddress(base, wallet, branch, current, known.get(`${branch}:${current}`))
			)
		);
		for (const address of batch) {
			found.push(address);
			unused = address.used ? 0 : unused + 1;
			index += 1;
			if (unused >= gapLimit) break;
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
	if (!navigator.onLine) throw new Error('오프라인에서는 동기화할 수 없습니다.');
	const base = apiBase(settings, wallet);
	if (!/^https?:\/\//.test(base)) throw new Error('Esplora API 주소를 확인하세요.');
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
