<script lang="ts">
	import { Telescope } from '@lucide/svelte';
	let {
		title,
		description,
		actionLabel,
		href
	}: { title: string; description: string; actionLabel?: string; href?: string } = $props();
</script>

<div class="empty-state">
	<div class="empty-icon"><Telescope size={27} /></div>
	<h2>{title}</h2>
	<p>{description}</p>
	{#if actionLabel && href}<a class="button primary" {href}>{actionLabel}</a>{/if}
</div>
