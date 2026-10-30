<script lang="ts">
	import { t, localizedHref } from '$lib/i18n';
	import { ArrowLeft } from '@lucide/svelte';
	let {
		title,
		subtitle,
		back,
		action
	}: { title: string; subtitle?: string; back?: string; action?: import('svelte').Snippet } =
		$props();
</script>

<header class="page-header">
	<div class="page-title-row">
		{#if back}<a class="icon-button back" href={localizedHref(back)} aria-label={t('back')}
				><ArrowLeft size={21} /></a
			>{/if}
		<div>
			{#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
			<h1>{title}</h1>
		</div>
	</div>
	{#if action}<div class="header-action">{@render action()}</div>{/if}
</header>
