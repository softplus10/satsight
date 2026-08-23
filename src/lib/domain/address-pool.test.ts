import { describe, expect, it } from 'vitest';
import { HDKey } from '@scure/bip32';
import { deriveAddress } from './bitcoin';
import { buildAddressPool, normalizeGapLimit } from './address-pool';
import type { Wallet, WatchedAddress } from './types';

const source = HDKey.fromMasterSeed(new Uint8Array(32).fill(9)).publicExtendedKey;
const wallet: Wallet = {
	id: 'wallet-1',
	name: 'Test',
	kind: 'xpub',
	network: 'mainnet',
	scriptType: 'native-segwit',
	source,
	color: '#fff',
	balance: 0,
	confirmedBalance: 0,
	txCount: 0,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z'
};

describe('address pool', () => {
	it('pre-derives one gap window for both receive and change branches', () => {
		const addresses = buildAddressPool(wallet, 20);
		expect(addresses).toHaveLength(40);
		expect(addresses.filter((address) => address.branch === 0)).toHaveLength(20);
		expect(addresses.filter((address) => address.branch === 1)).toHaveLength(20);
		expect(addresses[0].address).toBe(deriveAddress(source, 'mainnet', 'native-segwit', 0, 0));
		expect(addresses.at(-1)).toMatchObject({ branch: 1, index: 19, label: '거스름 #20' });
	});

	it('preserves synced metadata and addresses beyond the initial window', () => {
		const existing: WatchedAddress = {
			...buildAddressPool(wallet, 5)[0],
			index: 25,
			id: `${wallet.id}:0:25`,
			address: deriveAddress(source, 'mainnet', 'native-segwit', 0, 25),
			label: '저축',
			used: true,
			balance: 1234,
			confirmedBalance: 1234,
			txCount: 2
		};
		const addresses = buildAddressPool(wallet, 20, [existing]);
		expect(addresses).toHaveLength(41);
		expect(addresses.find((address) => address.id === existing.id)).toEqual(existing);
	});

	it('clamps unreasonable gap limits', () => {
		expect(normalizeGapLimit(1)).toBe(5);
		expect(normalizeGapLimit(20.9)).toBe(20);
		expect(normalizeGapLimit(500)).toBe(50);
		expect(normalizeGapLimit(Number.NaN)).toBe(20);
	});
});
