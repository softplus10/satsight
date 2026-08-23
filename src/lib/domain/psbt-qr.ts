import { Buffer } from 'buffer';
import { UR, URDecoder, UREncoder } from '@ngraveio/bc-ur';
import { cborDecode, cborEncode } from '@ngraveio/bc-ur/dist/cbor.js';
import type { QrSegmentProgress } from './qr-segments';

export interface PsbtQrResult {
	psbt?: Uint8Array;
	progress?: QrSegmentProgress;
	error?: string;
}

const UR_PSBT = /^ur:crypto-psbt\//i;
const SPECTER_SEGMENT = /^p(\d+)of(\d+) ([\s\S]*)$/i;
const PSBT_MAGIC = '70736274ff';
const MAX_SEGMENTS = 999;

function byteBuffer(value: unknown): Buffer | undefined {
	if (Buffer.isBuffer(value)) return value;
	if (value instanceof Uint8Array) return Buffer.from(value);
	if (
		value &&
		typeof value === 'object' &&
		(value as { type?: unknown }).type === 'Buffer' &&
		Array.isArray((value as { data?: unknown }).data)
	) {
		return Buffer.from((value as { data: number[] }).data);
	}
	return undefined;
}

function validPsbt(value: Uint8Array | undefined): value is Uint8Array {
	return Boolean(value && Buffer.from(value).subarray(0, 5).toString('hex') === PSBT_MAGIC);
}

export function createPsbtUrEncoder(psbt: Uint8Array, fragmentLength = 100) {
	if (!validPsbt(psbt)) throw new Error('PSBT 데이터가 올바르지 않습니다.');
	if (!Number.isSafeInteger(fragmentLength) || fragmentLength < 10 || fragmentLength > 500) {
		throw new Error('UR QR 조각 크기가 올바르지 않습니다.');
	}
	const cbor = cborEncode(Buffer.from(psbt));
	return new UREncoder(new UR(cbor, 'crypto-psbt'), fragmentLength);
}

export class PsbtQrCollector {
	private urDecoder: URDecoder | undefined;
	private parts: Array<string | undefined> | undefined;

	reset() {
		this.urDecoder = undefined;
		this.parts = undefined;
	}

	add(value: string): PsbtQrResult {
		const trimmed = value.trim();
		if (UR_PSBT.test(trimmed)) return this.addUr(trimmed);
		if (this.urDecoder) return { progress: this.urProgress() };
		const segment = trimmed.match(SPECTER_SEGMENT);
		if (segment) return this.addSpecter(segment);
		if (this.parts) return { progress: this.specterProgress() };
		return this.decodeBase64(trimmed);
	}

	private addUr(value: string): PsbtQrResult {
		if (this.parts) return { progress: this.specterProgress() };
		this.urDecoder ??= new URDecoder();
		try {
			this.urDecoder.receivePart(value);
		} catch {
			return { error: '손상되었거나 지원하지 않는 signed PSBT UR 조각입니다.' };
		}
		const progress = this.urProgress();
		if (!this.urDecoder.isComplete()) return { progress };
		try {
			const ur = this.urDecoder.resultUR();
			const psbt = byteBuffer(cborDecode(ur.cbor));
			return validPsbt(psbt)
				? { psbt: new Uint8Array(psbt), progress: { ...progress, percent: 100 } }
				: { error: 'QR에 올바른 signed PSBT가 없습니다.', progress };
		} catch {
			return { error: 'signed PSBT UR을 해석하지 못했습니다.', progress };
		}
	}

	private addSpecter(match: RegExpMatchArray): PsbtQrResult {
		const index = Number(match[1]);
		const total = Number(match[2]);
		if (
			!Number.isSafeInteger(index) ||
			!Number.isSafeInteger(total) ||
			index < 1 ||
			index > total ||
			total > MAX_SEGMENTS
		) {
			return { error: 'signed PSBT 분할 QR 번호가 올바르지 않습니다.' };
		}
		this.parts ??= new Array<string | undefined>(total);
		if (this.parts.length !== total) return { progress: this.specterProgress() };
		this.parts[index - 1] ??= match[3];
		const progress = this.specterProgress();
		if (progress.received !== progress.total) return { progress };
		return { ...this.decodeBase64(this.parts.join('')), progress };
	}

	private decodeBase64(value: string): PsbtQrResult {
		try {
			const psbt = Buffer.from(value, 'base64');
			return validPsbt(psbt)
				? { psbt: new Uint8Array(psbt) }
				: { error: '지원하는 signed PSBT QR이 아닙니다.' };
		} catch {
			return { error: 'signed PSBT QR을 해석하지 못했습니다.' };
		}
	}

	private urProgress(): QrSegmentProgress {
		if (!this.urDecoder) return { received: 0, total: 0, percent: 0 };
		if (this.urDecoder.isComplete()) {
			const total = Math.max(1, this.urDecoder.expectedPartCount());
			return { received: total, total, percent: 100 };
		}
		const total = this.urDecoder.expectedPartCount();
		const received = Math.min(total, this.urDecoder.receivedPartIndexes().length);
		return {
			received,
			total,
			percent: total ? Math.min(99, Math.round((received / total) * 100)) : 0
		};
	}

	private specterProgress(): QrSegmentProgress {
		const total = this.parts?.length ?? 0;
		const received = this.parts?.filter((part) => part !== undefined).length ?? 0;
		return { received, total, percent: total ? Math.round((received / total) * 100) : 0 };
	}
}
