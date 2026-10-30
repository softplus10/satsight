<script lang="ts">
	import { t } from '$lib/i18n';
	import { Plus } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import WalletCard from '$lib/components/WalletCard.svelte';
	import { walletState } from '$lib/state/wallets.svelte';
</script>

<svelte:head><title>{t('page_title', { title: t('wallets') })}</title></svelte:head>
<main class="page">
	<PageHeader title={t('wallets')}>
		{#snippet action()}<a class="button small primary" href="/wallets/new"
				><Plus size={17} /> {t('add')}</a
			>{/snippet}
	</PageHeader>
	{#if walletState.wallets.length}
		<div class="wallet-list">
			{#each walletState.wallets as wallet (wallet.id)}<WalletCard {wallet} />{/each}
		</div>
	{:else if walletState.ready}
		<EmptyState
			title={t('no_wallets')}
			description={t('add_wallet_help')}
			actionLabel={t('add_wallet')}
			href="/wallets/new"
		/>
	{/if}
</main>
