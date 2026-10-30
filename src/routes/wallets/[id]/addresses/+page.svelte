<script lang="ts">
	import { t } from '$lib/i18n';
	import { addressLabel } from '$lib/i18n/address-label';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { Check, Copy, QrCode } from '@lucide/svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import AddressQrDialog from '$lib/components/AddressQrDialog.svelte';
	import { shortAddress } from '$lib/domain/bitcoin';
	import type { Wallet, WatchedAddress } from '$lib/domain/types';
	import { walletState } from '$lib/state/wallets.svelte';

	const PAGE_SIZE = 20;
	let wallet = $state<Wallet>();
	let addresses = $state<WatchedAddress[]>([]);
	let copied = $state('');
	let copyError = $state('');
	let branch = $state<0 | 1>(0);
	let qrAddress = $state<WatchedAddress>();
	let loadingMore = $state(false);
	let loadError = $state('');
	let hasMore = $state(true);
	let sentinel = $state<HTMLDivElement>();
	let nextIndex = 0;
	let generation = 0;

	onMount(async () => {
		await walletState.initialize();
		wallet = walletState.wallets.find((item) => item.id === page.params.id);
		if (wallet) await selectBranch(0);
		else hasMore = false;
	});
	onDestroy(() => {
		generation += 1;
	});

	async function selectBranch(value: 0 | 1) {
		branch = value;
		generation += 1;
		addresses = [];
		nextIndex = 0;
		hasMore = true;
		loadingMore = false;
		loadError = '';
		await loadMore();
	}
	async function loadMore() {
		if (!wallet || loadingMore || !hasMore) return;
		const request = generation;
		loadingMore = true;
		loadError = '';
		try {
			const result = await walletState.addressPage(wallet.id, branch, nextIndex, PAGE_SIZE);
			// Ignore an old page when the user switches receive/change branches quickly.
			if (request !== generation) return;
			addresses = [...addresses, ...result];
			nextIndex += result.length;
			hasMore = wallet.kind === 'xpub' && result.length === PAGE_SIZE;
		} catch (cause) {
			if (request === generation)
				loadError = cause instanceof Error ? cause.message : t('address_page_failed');
		} finally {
			if (request === generation) loadingMore = false;
		}
	}
	$effect(() => {
		if (!sentinel || !hasMore || loadError) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) void loadMore();
			},
			{ rootMargin: '200px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});
	async function copy(address: string) {
		try {
			await navigator.clipboard.writeText(address);
			copied = address;
			copyError = '';
		} catch {
			copyError = t('address_copy_failed');
		}
	}
</script>

<svelte:head><title>{t('page_title', { title: t('addresses') })}</title></svelte:head>
<main class="page narrow">
	<PageHeader title={t('addresses')} subtitle={wallet?.name} back={`/wallets/${page.params.id}`} />
	<div class="tab-row">
		<button class:active={branch === 0} onclick={() => selectBranch(0)}
			>{t('receive_addresses')}</button
		>
		<button class:active={branch === 1} onclick={() => selectBranch(1)}
			>{t('change_addresses')}</button
		>
	</div>
	{#if copyError}<p class="form-error" role="alert">{copyError}</p>{/if}
	<div class="address-list" aria-busy={loadingMore}>
		{#each addresses as item (item.id)}
			<div class="address-card">
				<div class="address-index">{item.index + 1}</div>
				<div>
					<strong>{addressLabel(item, wallet?.kind === 'address')}</strong>
					<code>{shortAddress(item.address, 12, 12)}</code>
					<span class:used={item.used}
						>{item.used ? t('used') : t('unused')} · {t('transaction_count', {
							count: item.txCount
						})}</span
					>
				</div>
				<div class="address-actions">
					<button onclick={() => (qrAddress = item)} aria-label={t('show_address_qr')}
						><QrCode size={18} /></button
					>
					<button onclick={() => copy(item.address)} aria-label={t('copy_address')}>
						{#if copied === item.address}<Check size={18} />{:else}<Copy size={18} />{/if}
					</button>
				</div>
			</div>
		{/each}
		{#if !addresses.length && !loadingMore && !loadError && !hasMore}
			<p class="footnote">{t('no_addresses_in_this_branch')}</p>
		{/if}
	</div>
	{#if loadError}<p class="form-error" role="alert">{loadError}</p>{/if}
	{#if hasMore}
		<div bind:this={sentinel} class="address-pagination">
			<button class="button secondary full" onclick={loadMore} disabled={loadingMore}>
				{loadingMore ? t('loading_addresses') : loadError ? t('try_again') : t('load_more')}
			</button>
		</div>
	{/if}
</main>

{#if qrAddress}
	<AddressQrDialog
		title={t('address')}
		address={qrAddress.address}
		description={addressLabel(qrAddress, wallet?.kind === 'address')}
		onClose={() => (qrAddress = undefined)}
	/>
{/if}
