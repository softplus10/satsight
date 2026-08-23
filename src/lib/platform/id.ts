/** Create a local record ID on browsers that do not expose crypto.randomUUID(). */
export function createLocalId(
	cryptoApi: Crypto | null | undefined = globalThis.crypto,
	fallbackRandom: () => number = Math.random
): string {
	if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();

	const bytes = new Uint8Array(16);
	if (typeof cryptoApi?.getRandomValues === 'function') {
		cryptoApi.getRandomValues(bytes);
	} else {
		// The ID is only an IndexedDB key, not cryptographic material. This last
		// fallback keeps old WebViews and non-secure HTTP contexts usable.
		for (let index = 0; index < bytes.length; index += 1) {
			bytes[index] = Math.floor(fallbackRandom() * 256);
		}
	}

	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
