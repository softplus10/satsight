export interface QrSegmentProgress {
	received: number;
	total: number;
	percent: number;
}

export interface QrSegmentResult {
	value?: string;
	progress?: QrSegmentProgress;
}

const SPECTER_SEGMENT = /^p(\d+)of(\d+) ([\s\S]*)$/i;
const MAX_SEGMENTS = 999;

/** Collects the legacy pXofY animated QR format used by Specter and SeedSigner. */
export class QrSegmentCollector {
	private parts: Array<string | undefined> | undefined;

	add(value: string): QrSegmentResult {
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
