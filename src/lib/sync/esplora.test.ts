import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Wallet, type WatchedAddress } from '$lib/domain/types';
import { findUnusedReceiveAddress, syncWatchWallet } from './esplora';

vi.mock('$lib/domain/bitcoin', () => ({
	deriveAddress: (
		_source: string,
		_network: string,
		_script: string,
		branch: number,
		index: number
	) => `address-${branch}-${index}`
}));
const wallet: Wallet = {
	id: 'test',
	name: 'Test',
	kind: 'xpub',
	network: 'mainnet',
	scriptType: 'native-segwit',
	source: 'xpub',
	color: '#fff',
	balance: 0,
	confirmedBalance: 0,
	txCount: 0,
	createdAt: '',
	updatedAt: ''
};
const known = (index: number, used = false, branch: 0 | 1 = 0): WatchedAddress => ({
	id: `test:${branch}:${index}`,
	walletId: 'test',
	address: `address-${branch}-${index}`,
	branch,
	index,
	label: '',
	used,
	balance: 0,
	confirmedBalance: 0,
	txCount: used ? 1 : 0
});
const stats = (confirmed = 0, mempool = 0) => ({
	chain_stats: { funded_txo_sum: confirmed ? 1000 : 0, spent_txo_sum: 0, tx_count: confirmed },
	mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0, tx_count: mempool }
});
beforeEach(() => vi.stubGlobal('navigator', { onLine: true }));
afterEach(() => vi.unstubAllGlobals());

describe('unused receive addresses', () => {
	it('starts after used receive indexes, skips current mempool activity, and ignores change indexes', async () => {
		const fetch = vi.fn(
			async (url: string) =>
				new Response(JSON.stringify(url.endsWith('address-0-4') ? stats(0, 1) : stats()))
		);
		vi.stubGlobal('fetch', fetch);
		const result = await findUnusedReceiveAddress(
			wallet,
			[known(3, true), known(100, true, 1)],
			DEFAULT_SETTINGS
		);
		expect(result.address).toMatchObject({ branch: 0, index: 5, used: false });
		expect(result.scannedAddresses.map((item) => item.index)).toEqual([4, 5]);
		expect(fetch).toHaveBeenCalledTimes(2);
	});
	it('does not label a used single address as a fresh address', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify(stats(1))))
		);
		await expect(
			findUnusedReceiveAddress(
				{ ...wallet, kind: 'address', source: 'address' },
				[],
				DEFAULT_SETTINGS
			)
		).rejects.toThrow(/transaction history/);
	});
	it('retains known usage even if a server later returns an empty history', async () => {
		const fetch = vi.fn(async () => new Response(JSON.stringify(stats())));
		vi.stubGlobal('fetch', fetch);
		await expect(
			findUnusedReceiveAddress(
				{ ...wallet, kind: 'address', source: 'address' },
				[known(0, true)],
				DEFAULT_SETTINGS
			)
		).rejects.toThrow(/transaction history/);
		expect(fetch).not.toHaveBeenCalled();
	});
	it('requires a successful online check instead of trusting an unused local flag', async () => {
		const fetch = vi.fn(async () => new Response('', { status: 503 }));
		vi.stubGlobal('fetch', fetch);
		await expect(findUnusedReceiveAddress(wallet, [known(0)], DEFAULT_SETTINGS)).rejects.toThrow(
			/503/
		);
		vi.stubGlobal('navigator', { onLine: false });
		await expect(findUnusedReceiveAddress(wallet, [known(0)], DEFAULT_SETTINGS)).rejects.toThrow(
			/internet/
		);
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});

describe('address discovery', () => {
	it('includes previously exposed addresses beyond both the unused gap and index 199', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				if (url.endsWith('/txs')) return new Response('[]');
				return new Response(JSON.stringify(url.endsWith('address-0-205') ? stats(1) : stats()));
			})
		);
		const result = await syncWatchWallet(wallet, [known(205)], {
			...DEFAULT_SETTINGS,
			gapLimit: 5
		});
		expect(result.wallet.balance).toBe(1000);
		expect(result.addresses.find((item) => item.branch === 0 && item.index === 205)?.used).toBe(
			true
		);
		expect(result.addresses.some((item) => item.branch === 0 && item.index === 210)).toBe(true);
	});
});
