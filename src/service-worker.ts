/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `satsight-${version}`;
const appShell = [...new Set([...build, ...files, '/', '/index.html'])];

async function cacheAppShell() {
	const cache = await caches.open(cacheName);
	await Promise.all(
		appShell.map(async (path) => {
			try {
				const request = new Request(path, { cache: 'reload' });
				const response = await fetch(request);
				if (response.ok) await cache.put(request, response);
			} catch {
				// A temporarily unavailable route must not prevent a new worker from
				// activating and replacing an older, incompatible app-shell cache.
			}
		})
	);
}

worker.addEventListener('install', (event) => {
	event.waitUntil(cacheAppShell().then(() => worker.skipWaiting()));
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		Promise.all([
			caches
				.keys()
				.then((keys) =>
					Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))
				),
			worker.clients.claim()
		])
	);
});

worker.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== worker.location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(async () => {
				return (
					(await caches.match(request)) ?? (await caches.match('/index.html')) ?? Response.error()
				);
			})
		);
		return;
	}

	event.respondWith(
		caches.match(request).then((cached) => {
			if (cached) return cached;
			return fetch(request).then((response) => {
				if (response.ok) {
					const copy = response.clone();
					void caches.open(cacheName).then((cache) => cache.put(request, copy));
				}
				return response;
			});
		})
	);
});
