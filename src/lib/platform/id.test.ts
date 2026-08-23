import { describe, expect, it, vi } from 'vitest';
import { createLocalId } from './id';

describe('createLocalId', () => {
	it('uses crypto.randomUUID when available', () => {
		const randomUUID = vi.fn(() => '123e4567-e89b-42d3-a456-426614174000');
		const cryptoApi = { randomUUID } as unknown as Crypto;

		expect(createLocalId(cryptoApi)).toBe('123e4567-e89b-42d3-a456-426614174000');
		expect(randomUUID).toHaveBeenCalledOnce();
	});

	it('creates an RFC 4122 version 4 ID without randomUUID', () => {
		const cryptoApi = {
			getRandomValues(bytes: Uint8Array) {
				bytes.fill(0xab);
				return bytes;
			}
		} as unknown as Crypto;

		expect(createLocalId(cryptoApi)).toBe('abababab-abab-4bab-abab-abababababab');
	});

	it('still creates an ID when Web Crypto is unavailable', () => {
		expect(createLocalId(null, () => 0)).toBe('00000000-0000-4000-8000-000000000000');
	});
});
