<script lang="ts">
	import { t } from '$lib/i18n';
	import { addressLabel } from '$lib/i18n/address-label';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Check, Copy } from '@lucide/svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { shortAddress } from '$lib/domain/bitcoin';
	import type { Wallet, WatchedAddress } from '$lib/domain/types';
	import { walletState } from '$lib/state/wallets.svelte';

	let wallet = $state<Wallet>();
	let addresses = $state<WatchedAddress[]>([]);
	let copied = $state('');
	let branch = $state<0 | 1>(0);
	onMount(async () => {
		await walletState.initialize();
		wallet = walletState.wallets.find((item) => item.id === page.params.id);
		if (wallet) addresses = await walletState.addresses(wallet.id);
	});
	async function copy(address: string) {
		await navigator.clipboard.writeText(address);
		copied = address;
		setTimeout(() => (copied = ''), 1500);
	}
</script>

<svelte:head><title>{t('page_title', { title: t('addresses') })}</title></svelte:head>
<main class="page narrow">
	<PageHeader title={t('addresses')} subtitle={wallet?.name} back={`/wallets/${page.params.id}`} />
	<div class="tab-row">
		<button class:active={branch === 0} onclick={() => (branch = 0)}
			>{t('receive_addresses')}</button
		>
		<button class:active={branch === 1} onclick={() => (branch = 1)}>{t('change_addresses')}</button
		>
	</div>
	<div class="address-list">
		{#each addresses.filter((item) => item.branch === branch) as item (item.id)}
			<div class="address-card">
				<div class="address-index">{item.index + 1}</div>
				<div>
					<strong>{addressLabel(item, wallet?.kind === 'address')}</strong><code
						>{shortAddress(item.address, 12, 12)}</code
					><span class:used={item.used}
						>{item.used ? t('used') : t('unused')} · {t('transaction_count', {
							count: item.txCount
						})}</span
					>
				</div>
				<button onclick={() => copy(item.address)} aria-label={t('copy_address')}
					>{#if copied === item.address}<Check size={18} />{:else}<Copy size={18} />{/if}</button
				>
			</div>
		{/each}
		{#if !addresses.some((item) => item.branch === branch)}
			<p class="footnote">{t('no_addresses_in_this_branch')}</p>
		{/if}
	</div>
</main>
