declare global {
	interface Window {
		__TAURI_INTERNALS__?: unknown;
	}
}

export async function openExternal(url: string): Promise<void> {
	if (window.__TAURI_INTERNALS__) {
		const { openUrl } = await import('@tauri-apps/plugin-opener');
		await openUrl(url);
		return;
	}
	window.open(url, '_blank', 'noopener,noreferrer');
}
