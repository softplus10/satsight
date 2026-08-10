<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	let {
		title,
		eyebrow,
		back,
		action
	}: { title: string; eyebrow?: string; back?: string; action?: import('svelte').Snippet } =
		$props();
</script>

<header class="page-header">
	<div class="page-title-row">
		{#if back}<a class="icon-button back" href={back} aria-label="뒤로"><ArrowLeft size={21} /></a
			>{/if}
		<div>
			{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
			<h1>{title}</h1>
		</div>
	</div>
	{#if action}<div class="header-action">{@render action()}</div>{/if}
</header>
