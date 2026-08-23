import type { SpendUtxo } from '$lib/domain/send';
import type { AppSettings, Wallet, WatchedAddress } from '$lib/domain/types';
import { esploraApiBase } from './esplora';

interface EsploraUtxo {
	txid: string;
	vout: number;
	value: number;
	status: { confirmed: boolean };
}

async function request(base: string, path: string, init?: RequestInit) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 20_000);
	try {
		const response = await fetch(`${base}${path}`, {
			...init,
			signal: controller.signal,
			headers: { Accept: 'application/json', ...init?.headers }
		});
		const body = await response.text();
		if (!response.ok) throw new Error(body || `Esplora 서버 오류 (${response.status})`);
		return body;
	} catch (cause) {
		if (cause instanceof DOMException && cause.name === 'AbortError') {
			throw new Error('Esplora 서버 응답 시간이 초과되었습니다.');
		}
		throw cause;
	} finally {
		clearTimeout(timeout);
	}
}

export async function fetchFeeRate(wallet: Wallet, settings: AppSettings, target = 3) {
	const base = esploraApiBase(settings, wallet);
	const estimates = JSON.parse(await request(base, '/fee-estimates')) as Record<string, number>;
	const available = Object.entries(estimates)
		.map(([blocks, rate]) => ({ blocks: Number(blocks), rate }))
		.filter((item) => Number.isFinite(item.blocks) && Number.isFinite(item.rate))
		.sort((a, b) => a.blocks - b.blocks);
	const estimate = available.find((item) => item.blocks >= target) ?? available.at(-1);
	return Math.max(1, Math.ceil(estimate?.rate ?? 1));
}

export async function fetchSpendUtxos(
	wallet: Wallet,
	addresses: WatchedAddress[],
	settings: AppSettings
): Promise<SpendUtxo[]> {
	const base = esploraApiBase(settings, wallet);
	const funded = addresses.filter((address) => address.used || address.balance > 0);
	const lists = await Promise.all(
		funded.map(async (address) => ({
			address,
			utxos: JSON.parse(await request(base, `/address/${address.address}/utxo`)) as EsploraUtxo[]
		}))
	);
	const confirmed = lists.flatMap(({ address, utxos }) =>
		utxos.filter((utxo) => utxo.status.confirmed).map((utxo) => ({ ...utxo, address }))
	);
	if (wallet.scriptType !== 'legacy') return confirmed;

	const rawTransactions = new Map<string, string>();
	await Promise.all(
		[...new Set(confirmed.map((utxo) => utxo.txid))].map(async (txid) => {
			rawTransactions.set(txid, await request(base, `/tx/${txid}/hex`));
		})
	);
	return confirmed.map((utxo) => ({
		...utxo,
		nonWitnessUtxo: rawTransactions.get(utxo.txid)
	}));
}

export async function broadcastTransaction(
	wallet: Wallet,
	settings: AppSettings,
	rawTransaction: string,
	expectedTxid: string
) {
	const base = esploraApiBase(settings, wallet);
	const txid = (
		await request(base, '/tx', {
			method: 'POST',
			headers: { 'Content-Type': 'text/plain' },
			body: rawTransaction
		})
	).trim();
	if (!/^[0-9a-f]{64}$/i.test(txid))
		throw new Error('브로드캐스트 응답의 txid가 올바르지 않습니다.');
	if (txid.toLowerCase() !== expectedTxid.toLowerCase()) {
		throw new Error('브로드캐스트된 거래의 txid가 서명된 거래와 다릅니다.');
	}
	return txid;
}
