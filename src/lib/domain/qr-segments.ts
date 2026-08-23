import { HDKey, type Versions } from '@scure/bip32';
import { Buffer } from 'buffer';
import { DataItem, URRegistryDecoder, decodeToDataItem, extend } from '@keystonehq/bc-ur-registry';

export interface QrSegmentProgress {
	received: number;
	total: number;
	percent: number;
}

export interface QrSegmentResult {
	value?: string;
	progress?: QrSegmentProgress;
	error?: string;
}

const SPECTER_SEGMENT = /^p(\d+)of(\d+) ([\s\S]*)$/i;
const SEEDSIGNER_UR = /^ur:crypto-(?:account|output)\//i;
const MAX_SEGMENTS = 999;
const MAINNET_VERSIONS: Versions = { public: 0x0488b21e, private: 0x0488ade4 };
const TESTNET_VERSIONS: Versions = { public: 0x043587cf, private: 0x04358394 };
const SINGLE_KEY_EXPRESSIONS = new Set(['403', '400,404', '404', '409']);

// Taproot's script-expression tag is newer than the registry package's built-in list.
extend.cbor.patchTags([409]);

interface UrKeyExpression {
	keyExpression: string;
	scriptTags: number[];
}

function dataMap(item: unknown): Record<string, unknown> | undefined {
	const value = item instanceof DataItem ? item.getData() : item;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function fingerprintHex(value: number): string {
	const buffer = Buffer.alloc(4);
	buffer.writeUInt32BE(value >>> 0, 0);
	return buffer.toString('hex');
}

function byteBuffer(value: unknown): Buffer | undefined {
	if (Buffer.isBuffer(value)) return value;
	if (value instanceof Uint8Array) return Buffer.from(value);
	if (
		value &&
		typeof value === 'object' &&
		(value as { type?: unknown }).type === 'Buffer' &&
		Array.isArray((value as { data?: unknown }).data)
	) {
		const bytes = (value as { data: unknown[] }).data;
		if (bytes.every((byte) => Number.isInteger(byte) && Number(byte) >= 0 && Number(byte) <= 255)) {
			return Buffer.from(bytes as number[]);
		}
	}
	return undefined;
}

function decodeUrKey(item: DataItem, fallbackFingerprint?: number): UrKeyExpression | undefined {
	const scriptTags: number[] = [];
	let current = item;
	while (current.getTag() !== 303) {
		const tag = current.getTag();
		const nested = current.getData();
		if (typeof tag !== 'number' || !(nested instanceof DataItem)) return undefined;
		scriptTags.push(tag);
		current = nested;
	}

	const keyData = dataMap(current);
	const publicKey = byteBuffer(keyData?.['3']);
	const chainCode = byteBuffer(keyData?.['4']);
	if (!publicKey || publicKey.length !== 33 || !chainCode || chainCode.length !== 32) {
		return undefined;
	}

	const originData = dataMap(keyData?.['6']);
	const rawComponents = originData?.['1'];
	const components: Array<{ index: number; hardened: boolean }> = [];
	if (Array.isArray(rawComponents)) {
		for (let offset = 0; offset < rawComponents.length; offset += 2) {
			const index = rawComponents[offset];
			const hardened = rawComponents[offset + 1];
			if (typeof index !== 'number' || typeof hardened !== 'boolean') return undefined;
			components.push({ index, hardened });
		}
	}

	const useInfo = dataMap(keyData?.['5']);
	const urNetwork = useInfo?.['2'];
	const testnet = urNetwork === 1 || (urNetwork === undefined && components[1]?.index === 1);
	const last = components.at(-1);
	const parentFingerprint = keyData?.['8'];
	const rawDepth = originData?.['3'];
	const depth = typeof rawDepth === 'number' ? rawDepth : components.length;
	if (!Number.isSafeInteger(depth) || depth < 0 || depth > 255) return undefined;
	const key = new HDKey({
		versions: testnet ? TESTNET_VERSIONS : MAINNET_VERSIONS,
		depth,
		index: last ? last.index + (last.hardened ? 0x80000000 : 0) : 0,
		parentFingerprint: typeof parentFingerprint === 'number' ? parentFingerprint : 0,
		chainCode: new Uint8Array(chainCode),
		publicKey: new Uint8Array(publicKey)
	}).publicExtendedKey;

	const sourceFingerprint = originData?.['2'];
	const fingerprint =
		typeof sourceFingerprint === 'number' ? sourceFingerprint : fallbackFingerprint;
	const path = components
		.map((component) => `${component.index}${component.hardened ? "'" : ''}`)
		.join('/');
	const originPrefix =
		typeof fingerprint === 'number'
			? `[${fingerprintHex(fingerprint)}${path ? `/${path}` : ''}]`
			: '';
	return { keyExpression: `${originPrefix}${key}`, scriptTags };
}

function descriptorForUrKey(decoded: UrKeyExpression): string | undefined {
	const key = `${decoded.keyExpression}/0/*`;
	const expression = decoded.scriptTags.join(',');
	if (expression === '403') return `pkh(${key})`;
	if (expression === '400,404') return `sh(wpkh(${key}))`;
	if (expression === '404') return `wpkh(${key})`;
	if (expression === '409') return `tr(${key})`;
	return undefined;
}

function decodeSeedSignerUr(decoder: URRegistryDecoder): string | undefined {
	const ur = decoder.resultUR();
	const root = decodeToDataItem(ur.cbor);
	if (ur.type === 'crypto-output') {
		const decoded = decodeUrKey(root);
		return decoded ? descriptorForUrKey(decoded) : undefined;
	}
	if (ur.type !== 'crypto-account') return undefined;

	const account = dataMap(root);
	const fingerprint = account?.['1'];
	const outputs = account?.['2'];
	if (!Array.isArray(outputs)) return undefined;
	for (const output of outputs) {
		if (!(output instanceof DataItem)) continue;
		const decoded = decodeUrKey(output, typeof fingerprint === 'number' ? fingerprint : undefined);
		if (decoded && SINGLE_KEY_EXPRESSIONS.has(decoded.scriptTags.join(','))) {
			return descriptorForUrKey(decoded);
		}
	}
	return undefined;
}

/** Collects Specter pXofY and Blockchain Commons UR animated QR formats. */
export class QrSegmentCollector {
	private parts: Array<string | undefined> | undefined;
	private urDecoder: URRegistryDecoder | undefined;

	reset() {
		this.parts = undefined;
		this.urDecoder = undefined;
	}

	add(value: string): QrSegmentResult {
		if (SEEDSIGNER_UR.test(value)) return this.addUr(value);
		if (this.urDecoder) return { progress: this.urProgress() };
		const match = value.match(SPECTER_SEGMENT);
		if (!match) {
			return this.parts ? { progress: this.progress() } : { value };
		}

		const index = Number(match[1]);
		const total = Number(match[2]);
		if (
			!Number.isSafeInteger(index) ||
			!Number.isSafeInteger(total) ||
			index < 1 ||
			total < 1 ||
			index > total ||
			total > MAX_SEGMENTS
		) {
			return this.parts ? { progress: this.progress() } : { value };
		}

		this.parts ??= new Array<string | undefined>(total);
		if (this.parts.length !== total) return { progress: this.progress() };

		this.parts[index - 1] ??= match[3];
		const progress = this.progress();
		if (progress.received !== progress.total) return { progress };

		return { value: this.parts.join(''), progress };
	}

	private addUr(value: string): QrSegmentResult {
		if (this.parts) return { progress: this.progress() };
		this.urDecoder ??= new URRegistryDecoder();
		try {
			this.urDecoder.receivePart(value);
		} catch {
			return { error: '손상되었거나 지원하지 않는 UR QR 조각입니다.' };
		}

		const progress = this.urProgress();
		if (!this.urDecoder.isComplete()) return { progress };
		try {
			const decoded = decodeSeedSignerUr(this.urDecoder);
			return decoded
				? { value: decoded, progress: { ...progress, percent: 100 } }
				: { error: '단일 서명 지갑 공개키가 아닌 UR QR입니다.', progress };
		} catch {
			return { error: 'UR QR의 공개키 정보를 해석하지 못했습니다.', progress };
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
			percent: total ? Math.min(99, Math.round(this.urDecoder.getProgress() * 100)) : 0
		};
	}

	private progress(): QrSegmentProgress {
		const total = this.parts?.length ?? 0;
		const received = this.parts?.filter((part) => part !== undefined).length ?? 0;
		return {
			received,
			total,
			percent: total ? Math.round((received / total) * 100) : 0
		};
	}
}
