<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TransactionRow from '$lib/components/TransactionRow.svelte';
	import { walletState } from '$lib/state/wallets.svelte';
	let filter = $state<'all' | 'received' | 'sent'>('all');
	const filtered = $derived(
		walletState.transactions.filter((item) => filter === 'all' || item.direction === filter)
	);
</script>

<svelte:head><title>거래 · SatSight</title></svelte:head>
<main class="page">
	<PageHeader title="거래 내역" eyebrow="ACTIVITY" />
	<div class="filter-row">
		<button class:active={filter === 'all'} onclick={() => (filter = 'all')}>전체</button><button
			class:active={filter === 'received'}
			onclick={() => (filter = 'received')}>받음</button
		><button class:active={filter === 'sent'} onclick={() => (filter = 'sent')}>보냄</button>
	</div>
	{#if filtered.length}<div class="panel transaction-list">
			{#each filtered as transaction (transaction.id)}<TransactionRow {transaction} />{/each}
		</div>{:else if walletState.ready}<EmptyState
			title="표시할 거래가 없어요"
			description="지갑을 동기화한 뒤에도 데이터는 오프라인으로 계속 볼 수 있습니다."
		/>{/if}
</main>
