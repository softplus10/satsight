import { describe, expect, it } from 'vitest';
import { Transaction } from '@scure/btc-signer';
import { Buffer } from 'buffer';
import { createPsbtUrEncoder, PsbtQrCollector } from './psbt-qr';

function examplePsbt() {
	const transaction = new Transaction({ allowUnknownOutputs: true });
	transaction.addInput({ txid: '55'.repeat(32), index: 0 });
	transaction.addOutput({ script: new Uint8Array([0x51]), amount: 1_000n });
	return transaction.toPSBT(0);
}

describe('PSBT QR', () => {
	it('round-trips a crypto-psbt animated UR using m of n progress', () => {
		const psbt = examplePsbt();
		const encoder = createPsbtUrEncoder(psbt, 30);
		const collector = new PsbtQrCollector();
		let decoded: Uint8Array | undefined;
		for (let index = 0; index < encoder.fragmentsLength; index += 1) {
			const result = collector.add(encoder.nextPart());
			expect(result.progress).toEqual({
				received: index + 1,
				total: encoder.fragmentsLength,
				percent: Math.round(((index + 1) / encoder.fragmentsLength) * 100)
			});
			decoded = result.psbt;
		}
		expect(decoded).toEqual(psbt);
	});

	it('accepts a static base64 PSBT', () => {
		const psbt = examplePsbt();
		expect(new PsbtQrCollector().add(Buffer.from(psbt).toString('base64')).psbt).toEqual(psbt);
	});

	it('assembles Specter PSBT frames', () => {
		const psbt = examplePsbt();
		const base64 = Buffer.from(psbt).toString('base64');
		const split = Math.ceil(base64.length / 2);
		const collector = new PsbtQrCollector();
		expect(collector.add(`p2of2 ${base64.slice(split)}`).progress?.percent).toBe(50);
		expect(collector.add(`p1of2 ${base64.slice(0, split)}`).psbt).toEqual(psbt);
	});
});
