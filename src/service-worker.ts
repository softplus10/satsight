/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `satsight-${version}`;
const appShell = [...new Set([...build, ...files, '/', '/index.html'])];

worker.addEventListener('install', (event) => {
	event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(appShell)));
	worker.skipWaiting();
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))
			)
	);
	worker.clients.claim();
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
