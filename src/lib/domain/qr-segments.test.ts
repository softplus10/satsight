import { describe, expect, it } from 'vitest';
import { HDKey } from '@scure/bip32';
import { Buffer } from 'buffer';
import {
	CryptoAccount,
	CryptoHDKey,
	CryptoKeypath,
	CryptoOutput,
	PathComponent,
	ScriptExpressions
} from '@keystonehq/bc-ur-registry';
import { parseWalletQr } from './bitcoin';
import { QrSegmentCollector } from './qr-segments';

function uint32(value: number) {
	const buffer = Buffer.alloc(4);
	buffer.writeUInt32BE(value >>> 0, 0);
	return buffer;
}

function nativeSegwitAccount() {
	const root = HDKey.fromMasterSeed(new Uint8Array(32).fill(7));
	const account = root.derive("m/84'/0'/0'");
	const hdKey = new CryptoHDKey({
		isMaster: false,
		key: Buffer.from(account.publicKey!),
		chainCode: Buffer.from(account.chainCode!),
		origin: new CryptoKeypath(
			[
				new PathComponent({ index: 84, hardened: true }),
				new PathComponent({ index: 0, hardened: true }),
				new PathComponent({ index: 0, hardened: true })
			],
			uint32(root.fingerprint),
			3
		),
		parentFingerprint: uint32(account.parentFingerprint)
	});
	return {
		account,
		registry: new CryptoAccount(uint32(root.fingerprint), [
			new CryptoOutput([ScriptExpressions.WITNESS_PUBLIC_KEY_HASH], hdKey)
		])
	};
}

describe('QR segment collector', () => {
	it('passes a regular QR value through immediately', () => {
		const collector = new QrSegmentCollector();
		expect(collector.add('zpub-example')).toEqual({ value: 'zpub-example' });
	});

	it('assembles Specter segments in any order', () => {
		const collector = new QrSegmentCollector();
		expect(collector.add('p2of3 middle')).toEqual({
			progress: { received: 1, total: 3, percent: 33 }
		});
		expect(collector.add('p1of3 start-')).toEqual({
			progress: { received: 2, total: 3, percent: 67 }
		});
		expect(collector.add('p3of3 -end')).toEqual({
			value: 'start-middle-end',
			progress: { received: 3, total: 3, percent: 100 }
		});
	});

	it('does not count a repeated frame twice', () => {
		const collector = new QrSegmentCollector();
		collector.add('p1of2 first');
		expect(collector.add('p1of2 first')).toEqual({
			progress: { received: 1, total: 2, percent: 50 }
		});
	});

	it('ignores frames from a sequence with a different total', () => {
		const collector = new QrSegmentCollector();
		collector.add('p1of2 first');
		expect(collector.add('p2of3 other')).toEqual({
			progress: { received: 1, total: 2, percent: 50 }
		});
	});

	it('decodes a SeedSigner crypto-account UR and reports m of n progress', () => {
		const { account, registry } = nativeSegwitAccount();
		const encoder = registry.toUREncoder(30);
		const collector = new QrSegmentCollector();
		let completed: ReturnType<QrSegmentCollector['add']> | undefined;

		for (let index = 0; index < encoder.fragmentsLength; index += 1) {
			const result = collector.add(encoder.nextPart());
			expect(result.progress).toEqual({
				received: index + 1,
				total: encoder.fragmentsLength,
				percent: Math.round(((index + 1) / encoder.fragmentsLength) * 100)
			});
			completed = result;
		}

		expect(completed?.value).toBeDefined();
		expect(parseWalletQr(completed!.value!)).toEqual({
			source: account.publicExtendedKey,
			kind: 'xpub',
			network: 'mainnet',
			scriptType: 'native-segwit'
		});
	});

	it('rejects a SeedSigner multisig account without importing the wrong wallet', () => {
		const frames = [
			'UR:CRYPTO-ACCOUNT/1-4/LPADAACSKPCYMOMNLGRYHDCKOEADCYSSMECPONAOLYTAADMETAADDLOXAXHDCLAOKSRLNLKPUEGYATHPMNSNIYMUECBY',
			'UR:CRYPTO-ACCOUNT/2-4/LPAOAACSKPCYMOMNLGRYHDCKKKGHZMLUZORPVDGUOTECSTTKTOLPCWPTNTLKZTTIZTBEAAHDCXVDTPMYRSTDMOPSCXFZ',
			'UR:CRYPTO-ACCOUNT/3-4/LPAXAACSKPCYMOMNLGRYHDCKSPZSBZSPGERLGDATUYNLPYBTGYIYYKBTWTAOSWKSVTSGCHBYDKYAVDAMTAADMONDGDFD',
			'UR:CRYPTO-ACCOUNT/4-4/LPAAAACSKPCYMOMNLGRYHDCKDYOTADLOCSDYYKADYKAEYKAOYKAOCYSSMECPONAXAAAYCYIOREKKJKAEAEAEWZWDMYON'
		];
		const collector = new QrSegmentCollector();

		frames.slice(0, -1).forEach((frame, index) => {
			expect(collector.add(frame).progress).toEqual({
				received: index + 1,
				total: 4,
				percent: (index + 1) * 25
			});
		});
		expect(collector.add(frames.at(-1)!)).toMatchObject({
			error: expect.stringContaining('단일 서명'),
			progress: { received: 4, total: 4, percent: 100 }
		});
	});
});
