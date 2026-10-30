<script lang="ts">
	import { t, localizedHref } from '$lib/i18n';
	import { walletSignatureLabel, walletScriptLabel } from '$lib/i18n/wallet-label';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		ArrowDownLeft,
		Copy,
		Download,
		Ellipsis,
		ExternalLink,
		QrCode,
		RotateCw,
		Send,
		Trash2
	} from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TransactionRow from '$lib/components/TransactionRow.svelte';
	import AddressQrDialog from '$lib/components/AddressQrDialog.svelte';
	import { formatBtc, formatSats } from '$lib/domain/bitcoin';
	import { walletExport } from '$lib/domain/wallet-export';
	import { downloadJson } from '$lib/platform/download';
	import type { Wallet, WatchedAddress } from '$lib/domain/types';
	import { walletState } from '$lib/state/wallets.svelte';
	import { openExternal } from '$lib/platform/external';

	let wallet = $state<Wallet>();
	let addresses = $state<WatchedAddress[]>([]);
	let menu = $state(false);
	let actionMessage = $state('');
	let actionFailed = $state(false);
	let syncMessage = $state('');
	let receiveOpen = $state(false);
	let receiveLoading = $state(false);
	let receiveValue = $state('');
	let receiveError = $state('');
	let receiveRequest = 0;
	const transactions = $derived(
		walletState.transactions.filter((item) => item.walletId === page.params.id)
	);

	onMount(async () => {
		await walletState.initialize();
		wallet = walletState.wallets.find((item) => item.id === page.params.id);
		if (wallet) addresses = await walletState.addresses(wallet.id);
	});

	async function copySource() {
		if (!wallet) return;
		menu = false;
		try {
			await navigator.clipboard.writeText(wallet.source);
			actionMessage = t('copied');
			actionFailed = false;
		} catch {
			actionMessage = t('public_info_copy_failed');
			actionFailed = true;
		}
	}
	function exportPublicWallet() {
		if (!wallet) return;
		menu = false;
		try {
			const name = wallet.name.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'wallet';
			downloadJson(`${name}.satsight.json`, walletExport(wallet));
			actionMessage = t('wallet_exported');
			actionFailed = false;
		} catch {
			actionMessage = t('wallet_export_failed');
			actionFailed = true;
		}
	}

	async function remove() {
		if (!wallet || !confirm(t('remove_wallet_confirm', { name: wallet.name }))) return;
		await walletState.removeWallet(wallet.id);
		await goto(localizedHref('/wallets'));
	}

	async function sync() {
		if (!wallet) return;
		syncMessage = '';
		try {
			await walletState.syncWallet(wallet.id);
			wallet = walletState.wallets.find((item) => item.id === page.params.id);
			if (wallet) addresses = await walletState.addresses(wallet.id);
			syncMessage = t('sync_complete');
		} catch (cause) {
			syncMessage = cause instanceof Error ? cause.message : t('sync_failed');
		}
	}

	function openExplorer() {
		if (!wallet || !addresses[0]) return;
		const base =
			wallet.network === 'mainnet' ? 'https://mempool.space' : 'https://mempool.space/testnet';
		void openExternal(`${base}/address/${addresses[0].address}`);
	}
	async function receive() {
		if (!wallet) return;
		const request = ++receiveRequest;
		receiveOpen = true;
		receiveLoading = true;
		receiveError = '';
		receiveValue = '';
		try {
			const address = await walletState.receiveAddress(wallet.id);
			if (request === receiveRequest) receiveValue = address.address;
		} catch (cause) {
			if (request === receiveRequest)
				receiveError = cause instanceof Error ? cause.message : t('receive_address_failed');
		} finally {
			if (request === receiveRequest) receiveLoading = false;
		}
	}
	function closeReceive() {
		receiveOpen = false;
		receiveRequest += 1; // Ignore a lookup that finishes after its dialog was closed.
	}
</script>

<svelte:head><title>{t('page_title', { title: wallet?.name ?? t('wallet') })}</title></svelte:head>
<main class="page">
	{#if wallet}
		<PageHeader
			title={wallet.name}
			subtitle={wallet.network === 'mainnet' ? t('mainnet') : t('testnet')}
			back="/wallets"
		>
			{#snippet action()}<div class="header-buttons">
					<button
						class="icon-button"
						class:spinning={walletState.syncingIds.includes(page.params.id ?? '')}
						onclick={sync}
						aria-label={t('sync_wallet')}><RotateCw size={19} /></button
					>
					<div class="menu-wrap">
						<button
							class="icon-button"
							onclick={() => (menu = !menu)}
							aria-label={t('menu')}
							aria-expanded={menu}><Ellipsis size={21} /></button
						>{#if menu}<div class="context-menu">
								<button onclick={copySource}
									><Copy size={16} />
									{wallet?.kind === 'xpub' ? t('copy_xpub') : t('copy_address')}</button
								>
								<button onclick={exportPublicWallet}
									><Download size={16} /> {t('export_wallet')}</button
								>
								<button class="danger" onclick={remove}
									><Trash2 size={16} /> {t('remove_wallet')}</button
								>
							</div>{/if}
					</div>
				</div>{/snippet}
		</PageHeader>
		<section class="wallet-hero" style={`--wallet-color:${wallet.color}`}>
			<div class="hero-balance"><strong>{formatBtc(wallet.balance)}</strong><span>BTC</span></div>
			<p>{formatSats(wallet.balance)} sats</p>
			<div class="hero-stats">
				<div>
					<span>{t('confirmed_balance')}</span><strong
						>{formatSats(wallet.confirmedBalance)} sats</strong
					>
				</div>
				<div>
					<span>{t('transactions')}</span><strong
						>{t('transaction_count', { count: wallet.txCount })}</strong
					>
				</div>
			</div>
		</section>
		{#if actionMessage}<p class="sync-message" class:failed={actionFailed} role="status">
				{actionMessage}
			</p>{/if}
		{#if syncMessage}<p class:failed={Boolean(wallet.syncError)} class="sync-message">
				{syncMessage}
			</p>{/if}

		<div class="detail-actions">
			<button onclick={receive}><ArrowDownLeft size={20} /><span>{t('receive')}</span></button>
			{#if wallet.kind === 'xpub'}<a href={localizedHref(`/wallets/${wallet.id}/send`)}
					><Send size={20} /><span>{t('send')}</span></a
				>{/if}
			<a href={localizedHref(`/wallets/${wallet.id}/addresses`)}
				><QrCode size={20} /><span>{t('addresses')}</span></a
			>
			<button onclick={openExplorer}><ExternalLink size={20} /><span>{t('explorer')}</span></button>
		</div>

		<section class="section-block">
			<div class="section-title"><h2>{t('wallet_information')}</h2></div>
			<div class="detail-panel">
				<div>
					<span>{t('signature_policy')}</span><strong>{walletSignatureLabel(wallet)}</strong>
				</div>
				<div>
					<span>{t('address_type')}</span><strong>{walletScriptLabel(wallet)}</strong>
				</div>
			</div>
		</section>

		<section class="section-block">
			<div class="section-title">
				<h2>{t('recent_transactions')}</h2>
				<a href={localizedHref('/transactions')}>{t('view_all')}</a>
			</div>
			{#if transactions.length}<div class="panel">
					{#each transactions.slice(0, 5) as transaction (transaction.id)}<TransactionRow
							{transaction}
						/>{/each}
				</div>{:else}<EmptyState
					title={t('no_transactions')}
					description={t('no_transactions_help')}
				/>{/if}
		</section>
	{:else if walletState.ready}
		<EmptyState
			title={t('wallet_not_found')}
			description={t('wallet_not_found_help')}
			actionLabel={t('wallets')}
			href={localizedHref('/wallets')}
		/>
	{/if}
</main>

{#if receiveOpen}
	<AddressQrDialog
		title={t('receive')}
		address={receiveValue}
		description={t('unused_receive_address')}
		loading={receiveLoading}
		error={receiveError}
		onClose={closeReceive}
		onRetry={receive}
	/>
{/if}
