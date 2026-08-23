import { describe, expect, it } from 'vitest';
import { HDKey } from '@scure/bip32';
import { Transaction } from '@scure/btc-signer';
import { buildAddressPool } from './address-pool';
import { deriveAddress } from './bitcoin';
import { createSpendPsbt, finalizeSignedPsbt } from './send';
import type { ScriptType, Wallet } from './types';

const root = HDKey.fromMasterSeed(new Uint8Array(32).fill(11));

function wallet(scriptType: ScriptType = 'native-segwit'): Wallet {
	const purpose =
		scriptType === 'legacy'
			? 44
			: scriptType === 'nested-segwit'
				? 49
				: scriptType === 'taproot'
					? 86
					: 84;
	const account = root.derive(`m/${purpose}'/0'/0'`);
	return {
		id: 'wallet-send',
		name: 'Send test',
		kind: 'xpub',
		network: 'mainnet',
		scriptType,
		source: account.publicExtendedKey,
		keyOrigin: {
			fingerprint: root.fingerprint,
			path: [0x80000000 + purpose, 0x80000000, 0x80000000]
		},
		color: '#fff',
		balance: 100_000,
		confirmedBalance: 100_000,
		txCount: 1,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z'
	};
}

function signingKey(scriptType: ScriptType = 'native-segwit') {
	const purpose =
		scriptType === 'legacy'
			? 44
			: scriptType === 'nested-segwit'
				? 49
				: scriptType === 'taproot'
					? 86
					: 84;
	return root.derive(`m/${purpose}'/0'/0'/0/0`).privateKey!;
}

describe('PSBT send flow', () => {
	it('creates, signs, verifies and finalizes a native SegWit PSBT', () => {
		const sourceWallet = wallet();
		const addresses = buildAddressPool(sourceWallet, 5);
		const inputAddress = { ...addresses[0], used: true, balance: 100_000 };
		const recipient = deriveAddress(sourceWallet.source, 'mainnet', 'native-segwit', 0, 4);
		const prepared = createSpendPsbt(
			sourceWallet,
			addresses,
			[
				{
					txid: '11'.repeat(32),
					vout: 0,
					value: 100_000,
					address: inputAddress
				}
			],
			recipient,
			25_000,
			2
		);
		expect(prepared.fee).toBeGreaterThan(0);
		expect(prepared.change).toBeGreaterThan(0);
		expect(prepared.changeAddress).toBe(
			deriveAddress(sourceWallet.source, 'mainnet', 'native-segwit', 1, 0)
		);

		const signed = Transaction.fromPSBT(prepared.psbt);
		expect(signed.sign(signingKey())).toBe(1);
		const finalized = finalizeSignedPsbt(prepared.psbt, signed.toPSBT(0));
		expect(finalized.hex).toMatch(/^020000000001/);
		expect(finalized.txid).toHaveLength(64);
		expect(finalized.fee).toBe(prepared.fee);
	});

	it('rejects a signed PSBT whose unsigned transaction was changed', () => {
		const sourceWallet = wallet();
		const addresses = buildAddressPool(sourceWallet, 5);
		const prepared = createSpendPsbt(
			sourceWallet,
			addresses,
			[
				{
					txid: '22'.repeat(32),
					vout: 1,
					value: 80_000,
					address: addresses[0]
				}
			],
			deriveAddress(sourceWallet.source, 'mainnet', 'native-segwit', 0, 3),
			20_000,
			1
		);
		const changed = Transaction.fromPSBT(prepared.psbt);
		changed.updateOutput(0, { amount: 19_999n });
		expect(() => finalizeSignedPsbt(prepared.psbt, changed.toPSBT(0))).toThrow(/원본과 다릅니다/);
	});

	it.each(['nested-segwit', 'taproot'] as const)('round-trips a %s PSBT', (scriptType) => {
		const sourceWallet = wallet(scriptType);
		const addresses = buildAddressPool(sourceWallet, 5);
		const prepared = createSpendPsbt(
			sourceWallet,
			addresses,
			[
				{
					txid: '33'.repeat(32),
					vout: 0,
					value: 120_000,
					address: addresses[0]
				}
			],
			deriveAddress(sourceWallet.source, 'mainnet', scriptType, 0, 4),
			30_000,
			2
		);
		const signed = Transaction.fromPSBT(prepared.psbt);
		expect(signed.sign(signingKey(scriptType))).toBe(1);
		expect(finalizeSignedPsbt(prepared.psbt, signed.toPSBT(0)).txid).toHaveLength(64);
	});

	it('includes the full previous transaction for a legacy input', () => {
		const sourceWallet = wallet('legacy');
		const addresses = buildAddressPool(sourceWallet, 5);
		const previous = new Transaction();
		previous.addOutputAddress(addresses[0].address, 150_000n);
		previous.addInput({
			txid: '44'.repeat(32),
			index: 0,
			finalScriptSig: new Uint8Array([0])
		});
		const prepared = createSpendPsbt(
			sourceWallet,
			addresses,
			[
				{
					txid: previous.id,
					vout: 0,
					value: 150_000,
					address: addresses[0],
					nonWitnessUtxo: previous.hex
				}
			],
			deriveAddress(sourceWallet.source, 'mainnet', 'legacy', 0, 4),
			40_000,
			2
		);
		const signed = Transaction.fromPSBT(prepared.psbt);
		expect(signed.getInput(0).nonWitnessUtxo).toBeDefined();
		expect(signed.sign(signingKey('legacy'))).toBe(1);
		expect(finalizeSignedPsbt(prepared.psbt, signed.toPSBT(0)).txid).toHaveLength(64);
	});

	it('requires account origin metadata', () => {
		const sourceWallet = { ...wallet(), keyOrigin: undefined };
		const addresses = buildAddressPool(sourceWallet, 5);
		expect(() =>
			createSpendPsbt(
				sourceWallet,
				addresses,
				[],
				deriveAddress(sourceWallet.source, 'mainnet', 'native-segwit', 0, 3),
				20_000,
				1
			)
		).toThrow(/origin/);
	});
});
