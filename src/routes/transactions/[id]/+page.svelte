<script lang="ts">
	import { page } from '$app/state';
	import { Copy, ExternalLink } from '@lucide/svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { formatSats, shortAddress } from '$lib/domain/bitcoin';
	import { walletState } from '$lib/state/wallets.svelte';
	const transaction = $derived(walletState.transactions.find((item) => item.id === page.params.id));
	const wallet = $derived(
		transaction ? walletState.wallets.find((item) => item.id === transaction.walletId) : undefined
	);
	async function copy(value: string) {
		await navigator.clipboard.writeText(value);
	}
</script>

<svelte:head><title>거래 상세 · SatSight</title></svelte:head>
<main class="page narrow">
	<PageHeader title="거래 상세" eyebrow="TRANSACTION" back="/transactions" />
	{#if transaction}
		<section class="tx-hero">
			<span class:pending={transaction.status === 'pending'}
				>{transaction.status === 'confirmed' ? '확정됨' : '확정 대기'}</span
			>
			<p>
				{transaction.direction === 'received'
					? '받은 금액'
					: transaction.direction === 'sent'
						? '보낸 금액'
						: '이동 금액'}
			</p>
			<strong class:positive={transaction.direction === 'received'}
				>{transaction.direction === 'received' ? '+' : '−'}{formatSats(Math.abs(transaction.value))}
				<small>sats</small></strong
			>{#if transaction.note}<em>{transaction.note}</em>{/if}
		</section>
		<section class="detail-panel standalone">
			<div><span>지갑</span><strong>{wallet?.name ?? '알 수 없음'}</strong></div>
			<div>
				<span>상태</span><strong
					>{transaction.status === 'confirmed'
						? `${transaction.blockHeight?.toLocaleString()} 블록`
						: 'Mempool'}</strong
				>
			</div>
			{#if transaction.fee !== undefined}<div>
					<span>수수료</span><strong>{formatSats(transaction.fee)} sats</strong>
				</div>{/if}
			<div>
				<span>Transaction ID</span><button class="copy-value" onclick={() => copy(transaction.txid)}
					><code>{shortAddress(transaction.txid, 12, 12)}</code><Copy size={15} /></button
				>
			</div>
		</section>
		<a
			class="button secondary full"
			target="_blank"
			rel="noreferrer"
			href={`${wallet?.network === 'testnet' ? 'https://mempool.space/testnet' : 'https://mempool.space'}/tx/${transaction.txid}`}
			><ExternalLink size={17} /> 블록 탐색기에서 보기</a
		>
	{/if}
</main>
