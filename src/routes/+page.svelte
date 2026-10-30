<script lang="ts">
	import { t, localizedHref } from '$lib/i18n';
	import { ArrowUpRight, Eye, EyeOff, Plus, RotateCw } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import TransactionRow from '$lib/components/TransactionRow.svelte';
	import WalletCard from '$lib/components/WalletCard.svelte';
	import { formatBtc, formatSats } from '$lib/domain/bitcoin';
	import { walletState } from '$lib/state/wallets.svelte';

	let hidden = $state(false);
	let syncing = $state(false);

	async function refresh() {
		syncing = true;
		await walletState.syncAll();
		syncing = false;
	}
</script>

<svelte:head><title>{t('page_title', { title: t('home') })}</title></svelte:head>

<main class="page dashboard">
	<header class="dashboard-header">
		<div>
			<h1>{t('overview')}</h1>
		</div>
		<button class="icon-button" class:spinning={syncing} onclick={refresh} aria-label={t('refresh')}
			><RotateCw size={20} /></button
		>
	</header>

	<section class="balance-card">
		<div class="balance-label">
			<span>{t('total_balance')}</span><button
				onclick={() => (hidden = !hidden)}
				aria-label={hidden ? t('show_balance') : t('hide_balance')}
				aria-pressed={hidden}
				>{#if hidden}<EyeOff size={19} />{:else}<Eye size={19} />{/if}</button
			>
		</div>
		<div class="balance-value">
			{hidden ? '••••••••' : formatBtc(walletState.totalBalance)} <span>BTC</span>
		</div>
		<p>{hidden ? '••••••' : formatSats(walletState.totalBalance)} sats</p>
		<div class="balance-footer">
			<span>{t('wallet_count', { count: walletState.wallets.length })}</span>
		</div>
	</section>

	<section class="quick-actions">
		<a href={localizedHref('/wallets/new')}
			><span><Plus size={21} /></span><strong>{t('add_wallet')}</strong></a
		>
		<a href={localizedHref('/transactions')}
			><span><ArrowUpRight size={21} /></span><strong>{t('transactions')}</strong></a
		>
	</section>

	<section class="section-block">
		<div class="section-title">
			<h2>{t('wallets')}</h2>
			<a href={localizedHref('/wallets')}>{t('view_all')}</a>
		</div>
		{#if walletState.wallets.length}
			<div class="card-list">
				{#each walletState.wallets.slice(0, 3) as wallet (wallet.id)}<WalletCard
						{wallet}
						hideAmounts={hidden}
						compact
					/>{/each}
			</div>
		{:else if walletState.ready}
			<EmptyState
				title={t('no_wallets')}
				description={t('add_wallet_help')}
				actionLabel={t('add_wallet')}
				href={localizedHref('/wallets/new')}
			/>
		{:else}
			<div class="skeleton-list"><i></i><i></i></div>
		{/if}
	</section>
	{#if walletState.wallets.some((wallet) => wallet.syncError)}
		<p class="sync-warning">
			{t('partial_sync_notice')}
		</p>
	{/if}

	{#if walletState.transactions.length}
		<section class="section-block">
			<div class="section-title">
				<h2>{t('recent_transactions')}</h2>
				<a href={localizedHref('/transactions')}>{t('view_all')}</a>
			</div>
			<div class="panel">
				{#each walletState.transactions.slice(0, 4) as transaction (transaction.id)}<TransactionRow
						{transaction}
						hideAmounts={hidden}
					/>{/each}
			</div>
		</section>
	{/if}
</main>
