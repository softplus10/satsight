import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings, Wallet, WatchedAddress } from '$lib/domain/types';
import { broadcastTransaction, fetchFeeRate, fetchSpendUtxos } from './send';

const wallet: Wallet = {
	id: 'wallet-network',
	name: 'Network',
	kind: 'xpub',
	network: 'mainnet',
	scriptType: 'native-segwit',
	source: 'xpub-unused',
	color: '#fff',
	balance: 20_000,
	confirmedBalance: 20_000,
	txCount: 1,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z'
};
const settings: AppSettings = {
	id: 'settings',
	currency: 'BTC',
	fiatCurrency: 'KRW',
	apiUrl: 'https://esplora.example/api',
	autoSync: false,
	gapLimit: 20,
	theme: 'dark'
};
const address: WatchedAddress = {
	id: 'wallet-network:0:0',
	walletId: wallet.id,
	address: 'bc1qexample',
	branch: 0,
	index: 0,
	label: '주소 #1',
	used: true,
	balance: 20_000,
	confirmedBalance: 20_000,
	txCount: 1
};

afterEach(() => vi.unstubAllGlobals());

describe('send Esplora client', () => {
	it('uses the nearest available fee estimate at or above the target', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({ 1: 8.1, 3: 4.2, 6: 2.1 })))
		);
		await expect(fetchFeeRate(wallet, settings, 2)).resolves.toBe(5);
	});

	it('returns confirmed UTXOs from funded wallet addresses', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify([
							{ txid: '11'.repeat(32), vout: 0, value: 20_000, status: { confirmed: true } },
							{ txid: '22'.repeat(32), vout: 1, value: 5_000, status: { confirmed: false } }
						])
					)
			)
		);
		await expect(fetchSpendUtxos(wallet, [address], settings)).resolves.toEqual([
			{
				txid: '11'.repeat(32),
				vout: 0,
				value: 20_000,
				status: { confirmed: true },
				address
			}
		]);
	});

	it('checks the txid returned after broadcast', async () => {
		const txid = 'ab'.repeat(32);
		const mocked = vi.fn(async () => new Response(txid));
		vi.stubGlobal('fetch', mocked);
		await expect(broadcastTransaction(wallet, settings, '0200', txid)).resolves.toBe(txid);
		expect(mocked).toHaveBeenCalledWith(
			'https://esplora.example/api/tx',
			expect.objectContaining({ method: 'POST', body: '0200' })
		);
	});
});
