<script lang="ts">
	import { t } from '$lib/i18n';
	import { onMount, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import { House, Landmark, ListTree, Settings, WifiOff } from '@lucide/svelte';
	import { Capacitor } from '@capacitor/core';
	import { StatusBar, Style } from '@capacitor/status-bar';
	import { walletState } from '$lib/state/wallets.svelte';

	let { children }: { children: Snippet } = $props();
	let online = $state(true);
	const navigation = $derived([
		{ href: '/', label: t('home'), icon: House },
		{ href: '/wallets', label: t('wallets'), icon: Landmark },
		{ href: '/transactions', label: t('transactions'), icon: ListTree },
		{ href: '/settings', label: t('settings'), icon: Settings }
	]);

	function active(href: string) {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}

	onMount(() => {
		if (Capacitor.isNativePlatform()) {
			void StatusBar.setStyle({ style: Style.Light });
			void StatusBar.setBackgroundColor({ color: '#0b0d10' });
		}
		walletState.initialize().then(() => {
			if (walletState.settings.autoSync && navigator.onLine) walletState.syncAll();
		});
		online = navigator.onLine;
		const update = () => (online = navigator.onLine);
		window.addEventListener('online', update);
		window.addEventListener('offline', update);
		return () => {
			window.removeEventListener('online', update);
			window.removeEventListener('offline', update);
		};
	});
</script>

<div class="app-shell">
	<aside class="sidebar">
		<a class="brand" href="/" aria-label={t('satsight_home')}
			><span>₿</span><strong>SatSight</strong></a
		>
		<nav aria-label={t('main_navigation')}>
			{#each navigation as item (item.href)}
				<a href={item.href} class:active={active(item.href)}>
					<item.icon size={19} strokeWidth={2} />
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>
	</aside>

	<div class="app-content">
		{#if !online}
			<div class="offline-banner"><WifiOff size={15} /> {t('offline_notice')}</div>
		{/if}
		{@render children()}
	</div>

	<nav class="bottom-nav" aria-label={t('main_navigation')}>
		{#each navigation as item (item.href)}
			<a href={item.href} class:active={active(item.href)}>
				<item.icon size={21} strokeWidth={active(item.href) ? 2.5 : 1.8} />
				<span>{item.label}</span>
			</a>
		{/each}
	</nav>
</div>
