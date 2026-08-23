import { describe, expect, it } from 'vitest';
import { HDKey } from '@scure/bip32';
import {
	deriveAddress,
	formatBtc,
	parseExtendedPublicKey,
	parseWalletQr,
	shortAddress,
	validateAddress,
	validateExtendedPublicKey
} from './bitcoin';

const seed = new Uint8Array(32).fill(7);
const root = HDKey.fromMasterSeed(seed);
const xpub = root.publicExtendedKey;
const ypub = HDKey.fromMasterSeed(seed, {
	public: 0x049d7cb2,
	private: 0x0488ade4
}).publicExtendedKey;
const zpub = HDKey.fromMasterSeed(seed, {
	public: 0x04b24746,
	private: 0x0488ade4
}).publicExtendedKey;

describe('bitcoin helpers', () => {
	it('validates an extended public key without accepting random text', () => {
		expect(validateExtendedPublicKey(xpub, 'mainnet')).toBe(true);
		expect(validateExtendedPublicKey(ypub, 'mainnet')).toBe(true);
		expect(validateExtendedPublicKey(zpub, 'mainnet')).toBe(true);
		expect(validateExtendedPublicKey(zpub, 'testnet')).toBe(false);
		expect(validateExtendedPublicKey('not-an-xpub', 'mainnet')).toBe(false);
	});

	it('normalizes SLIP-132 public keys and retains their script type', () => {
		expect(parseExtendedPublicKey(ypub)).toEqual({
			source: xpub,
			network: 'mainnet',
			scriptType: 'nested-segwit'
		});
		expect(parseExtendedPublicKey(zpub)).toEqual({
			source: xpub,
			network: 'mainnet',
			scriptType: 'native-segwit'
		});
	});

	it('parses a standalone key expression with SeedSigner origin information', () => {
		expect(parseExtendedPublicKey(`[d34db33f/84'/0'/0']${xpub}`)).toEqual({
			source: xpub,
			network: 'mainnet',
			scriptType: 'native-segwit',
			origin: {
				fingerprint: 0xd34db33f,
				path: [0x80000054, 0x80000000, 0x80000000]
			}
		});
		expect(parseExtendedPublicKey(`[d34db33f/49h/0h/0h]${ypub}`)).toEqual({
			source: xpub,
			network: 'mainnet',
			scriptType: 'nested-segwit',
			origin: {
				fingerprint: 0xd34db33f,
				path: [0x80000031, 0x80000000, 0x80000000]
			}
		});
		expect(parseExtendedPublicKey(`[d34db33f/84'/1'/0']${xpub}`)).toBeNull();
		expect(parseExtendedPublicKey(`[nothex/84'/0'/0']${xpub}`)).toBeNull();
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

	it('parses address, BIP21, xpub and descriptor QR values', () => {
		const address = deriveAddress(xpub, 'mainnet', 'native-segwit', 0, 0);
		expect(parseWalletQr(`bitcoin:${address}?amount=0.01`)?.source).toBe(address);
		expect(parseWalletQr(xpub)).toMatchObject({ kind: 'xpub', network: 'mainnet' });
		expect(parseWalletQr(`sh(wpkh(${xpub}/0/*))`)).toMatchObject({
			kind: 'xpub',
			scriptType: 'nested-segwit'
		});
		expect(parseWalletQr(ypub)).toMatchObject({
			source: xpub,
			kind: 'xpub',
			network: 'mainnet',
			scriptType: 'nested-segwit'
		});
		expect(parseWalletQr(`wpkh(${zpub}/0/*)`)).toMatchObject({
			source: xpub,
			scriptType: 'native-segwit'
		});
		expect(parseWalletQr(`[d34db33f/84h/0h/0h]${zpub}`)).toMatchObject({
			source: xpub,
			scriptType: 'native-segwit',
			keyOrigin: { fingerprint: 0xd34db33f }
		});
		expect(parseWalletQr(`wpkh([d34db33f/84h/0h/0h]${zpub}/0/*)`)).toMatchObject({
			source: xpub,
			scriptType: 'native-segwit',
			keyOrigin: { fingerprint: 0xd34db33f }
		});
		expect(parseWalletQr('not-bitcoin-data')).toBeNull();
	});
});
