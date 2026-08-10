import { describe, expect, it } from 'vitest';
import { HDKey } from '@scure/bip32';
import {
	deriveAddress,
	formatBtc,
	shortAddress,
	validateAddress,
	validateExtendedPublicKey
} from './bitcoin';

const root = HDKey.fromMasterSeed(new Uint8Array(32).fill(7));
const xpub = root.publicExtendedKey;

describe('bitcoin helpers', () => {
	it('validates an extended public key without accepting random text', () => {
		expect(validateExtendedPublicKey(xpub, 'mainnet')).toBe(true);
		expect(validateExtendedPublicKey('not-an-xpub', 'mainnet')).toBe(false);
	});

	it('derives deterministic, network-aware addresses', () => {
		const first = deriveAddress(xpub, 'mainnet', 'native-segwit', 0, 0);
		const second = deriveAddress(xpub, 'mainnet', 'native-segwit', 0, 1);
		expect(first).toMatch(/^bc1q/);
		expect(first).not.toBe(second);
		expect(validateAddress(first, 'mainnet')).toBe(true);
		expect(validateAddress(first, 'testnet')).toBe(false);
	});

	it.each([
		['legacy', /^1/],
		['nested-segwit', /^3/],
		['native-segwit', /^bc1q/],
		['taproot', /^bc1p/]
	] as const)('derives a valid %s address', (scriptType, prefix) => {
		const address = deriveAddress(xpub, 'mainnet', scriptType, 0, 0);
		expect(address).toMatch(prefix);
		expect(validateAddress(address, 'mainnet')).toBe(true);
	});

	it('formats bitcoin values and long identifiers', () => {
		expect(formatBtc(123_456_789)).toBe('1.23456789');
		expect(shortAddress('bc1q1234567890abcdefghijkl')).toBe('bc1q1234…efghijkl');
	});
});
