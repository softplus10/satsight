import { describe, expect, it } from 'vitest';
import { QrSegmentCollector } from './qr-segments';

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
});
