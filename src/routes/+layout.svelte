<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { i18n, intlLocale, localeFromUrl, setLocale } from '$lib/i18n';
	// The URL is the source of truth, including query-only and history navigation.
	$effect.pre(() => {
		setLocale(localeFromUrl(page.url));
	});
	$effect(() => {
		document.documentElement.lang = intlLocale(i18n.locale);
	});
	import AppShell from '$lib/components/AppShell.svelte';
	let { children } = $props();
</script>

<AppShell>{@render children()}</AppShell>
