<script lang="ts">
	import '../app.css';
	import { i18n } from '$lib/i18n';
	$effect(() => {
		document.documentElement.lang = i18n.locale;
	});
	import AppShell from '$lib/components/AppShell.svelte';
	let { children } = $props();
</script>

<AppShell>{@render children()}</AppShell>
