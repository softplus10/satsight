<script lang="ts">
	import { t } from '$lib/i18n';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TransactionRow from '$lib/components/TransactionRow.svelte';
	import { walletState } from '$lib/state/wallets.svelte';
	let filter = $state<'all' | 'received' | 'sent'>('all');
	const filtered = $derived(
		walletState.transactions.filter((item) => filter === 'all' || item.direction === filter)
	);
</script>

<svelte:head><title>{t('page_title', { title: t('transactions') })}</title></svelte:head>
<main class="page">
	<PageHeader title={t('transactions')} />
	<div class="filter-row">
		<button class:active={filter === 'all'} onclick={() => (filter = 'all')}>{t('all')}</button
		><button class:active={filter === 'received'} onclick={() => (filter = 'received')}
			>{t('received')}</button
		><button class:active={filter === 'sent'} onclick={() => (filter = 'sent')}>{t('sent')}</button>
	</div>
	{#if filtered.length}<div class="panel transaction-list">
			{#each filtered as transaction (transaction.id)}<TransactionRow {transaction} />{/each}
		</div>{:else if walletState.ready}<EmptyState
			title={t('no_transactions')}
			description={t('no_transactions_help')}
		/>{/if}
</main>
