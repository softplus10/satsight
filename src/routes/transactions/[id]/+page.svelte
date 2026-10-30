<script lang="ts">
	import { t, formatNumber } from '$lib/i18n';
	import { page } from '$app/state';
	import { Copy, ExternalLink } from '@lucide/svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { formatSats, shortAddress } from '$lib/domain/bitcoin';
	import { walletState } from '$lib/state/wallets.svelte';
	import { openExternal } from '$lib/platform/external';
	const transaction = $derived(walletState.transactions.find((item) => item.id === page.params.id));
	const wallet = $derived(
		transaction ? walletState.wallets.find((item) => item.id === transaction.walletId) : undefined
	);
	async function copy(value: string) {
		await navigator.clipboard.writeText(value);
	}
	function openExplorer() {
		if (!transaction) return;
		const base =
			wallet?.network === 'testnet' ? 'https://mempool.space/testnet' : 'https://mempool.space';
		void openExternal(`${base}/tx/${transaction.txid}`);
	}
</script>

<svelte:head><title>{t('page_title', { title: t('transaction_details') })}</title></svelte:head>
<main class="page narrow">
	<PageHeader title={t('transaction_details')} back="/transactions" />
	{#if transaction}
		<section class="tx-hero">
			<span class:pending={transaction.status === 'pending'}
				>{transaction.status === 'confirmed' ? t('confirmed') : t('pending')}</span
			>
			<p>
				{transaction.direction === 'received'
					? t('amount_received')
					: transaction.direction === 'sent'
						? t('amount_sent')
						: t('amount_moved')}
			</p>
			<strong class:positive={transaction.direction === 'received'}
				>{transaction.direction === 'received' ? '+' : '−'}{formatSats(Math.abs(transaction.value))}
				<small>sats</small></strong
			>{#if transaction.note}<em>{transaction.note}</em>{/if}
		</section>
		<section class="detail-panel standalone">
			<div><span>{t('wallet')}</span><strong>{wallet?.name ?? t('unknown')}</strong></div>
			<div>
				<span>{t('status')}</span><strong
					>{transaction.status === 'confirmed'
						? t('block', { height: formatNumber(transaction.blockHeight ?? 0) })
						: t('pending')}</strong
				>
			</div>
			{#if transaction.fee !== undefined}<div>
					<span>{t('fee')}</span><strong>{formatSats(transaction.fee)} sats</strong>
				</div>{/if}
			<div>
				<span>{t('transaction_id')}</span><button
					class="copy-value"
					onclick={() => copy(transaction.txid)}
					><code>{shortAddress(transaction.txid, 12, 12)}</code><Copy size={15} /></button
				>
			</div>
		</section>
		<button class="button secondary full" onclick={openExplorer}
			><ExternalLink size={17} /> {t('view_in_explorer')}</button
		>
	{/if}
</main>
