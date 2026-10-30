import { describe, expect, it } from 'vitest';
import { HDKey } from '@scure/bip32';
import { walletExport } from './wallet-export';
import { parseWalletQr } from './bitcoin';
import { walletScriptLabel, walletSignatureLabel } from '$lib/i18n/wallet-label';
import type { Wallet, ScriptType } from './types';

const seed = new Uint8Array(32).fill(7);
function accountWallet(scriptType: ScriptType, purpose: number): Wallet {
	const account = HDKey.fromMasterSeed(seed).derive(`m/${purpose}'/0'/0'`);
	return {
		id: 'local-only-id',
		name: 'Abandon zpub',
		kind: 'xpub',
		network: 'mainnet',
		scriptType,
		source: account.publicExtendedKey,
		keyOrigin: { fingerprint: 0x1234abcd, path: [purpose + 0x80000000, 0x80000000, 0x80000000] },
		color: '#fff',
		balance: 123456789,
		confirmedBalance: 120000000,
		txCount: 275,
		createdAt: '',
		updatedAt: '',
		syncError: 'local-only-error'
	};
}

describe('public wallet exports', () => {
	it.each([
		['legacy', 44],
		['nested-segwit', 49],
		['native-segwit', 84],
		['taproot', 86]
	] as const)(
		'retains %s account identity, origin, and both descriptor branches',
		(scriptType, purpose) => {
			const wallet = accountWallet(scriptType, purpose);
			const exported = walletExport(wallet);
			expect(parseWalletQr(JSON.stringify(exported))).toMatchObject({
				kind: 'xpub',
				source: wallet.source,
				network: wallet.network,
				scriptType,
				keyOrigin: wallet.keyOrigin
			});
			expect(exported).toMatchObject({
				name: 'Abandon zpub',
				descriptor: expect.stringContaining('/0/*'),
				changeDescriptor: expect.stringContaining('/1/*')
			});
			for (const key of ['id', 'balance', 'confirmedBalance', 'txCount', 'syncError', 'color'])
				expect(exported).not.toHaveProperty(key);
		}
	);
	it('exports address-only wallets without claiming an account or signing policy', () => {
		const wallet: Wallet = {
			...accountWallet('native-segwit', 84),
			kind: 'address',
			source: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'
		};
		const exported = walletExport(wallet);
		expect(exported).toMatchObject({ kind: 'address', address: wallet.source });
		expect(exported).not.toHaveProperty('keyOrigin');
		expect(exported).not.toHaveProperty('descriptor');
		expect(parseWalletQr(JSON.stringify(exported))).toMatchObject({
			kind: 'address',
			source: wallet.source
		});
		expect(walletSignatureLabel(wallet)).toBe('Unknown');
		expect(walletScriptLabel(wallet)).toBe('P2SH');
	});
	it('identifies supported account imports as single-signature wallets', () => {
		const wallet = accountWallet('taproot', 86);
		expect(walletSignatureLabel(wallet)).toBe('Single sig');
		expect(walletScriptLabel(wallet)).toBe('Taproot');
	});
});
