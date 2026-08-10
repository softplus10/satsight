<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Copy, Ellipsis, ExternalLink, QrCode, RotateCw, Trash2 } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TransactionRow from '$lib/components/TransactionRow.svelte';
	import { formatBtc, formatSats, shortAddress, walletDescriptor } from '$lib/domain/bitcoin';
	import type { Wallet, WatchedAddress } from '$lib/domain/types';
	import { walletState } from '$lib/state/wallets.svelte';

	let wallet = $state<Wallet>();
	let addresses = $state<WatchedAddress[]>([]);
	let copied = $state(false);
	let menu = $state(false);
	let syncMessage = $state('');
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
		await navigator.clipboard.writeText(wallet.source);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	async function remove() {
		if (!wallet || !confirm(`“${wallet.name}” 지갑을 이 기기에서 삭제할까요?`)) return;
		await walletState.removeWallet(wallet.id);
		await goto('/wallets');
	}

	async function sync() {
		if (!wallet) return;
		syncMessage = '';
		try {
			await walletState.syncWallet(wallet.id);
			wallet = walletState.wallets.find((item) => item.id === page.params.id);
			if (wallet) addresses = await walletState.addresses(wallet.id);
			syncMessage = '최신 데이터로 동기화했습니다.';
		} catch (cause) {
			syncMessage = cause instanceof Error ? cause.message : '동기화하지 못했습니다.';
		}
	}
</script>

<svelte:head><title>{wallet?.name ?? '지갑'} · SatSight</title></svelte:head>
<main class="page">
	{#if wallet}
		<PageHeader title={wallet.name} eyebrow={wallet.network.toUpperCase()} back="/wallets">
			{#snippet action()}<div class="header-buttons">
					<button
						class="icon-button"
						class:spinning={walletState.syncingIds.includes(page.params.id ?? '')}
						onclick={sync}
						aria-label="지갑 동기화"><RotateCw size={19} /></button
					>
					<div class="menu-wrap">
						<button class="icon-button" onclick={() => (menu = !menu)} aria-label="메뉴"
							><Ellipsis size={21} /></button
						>{#if menu}<div class="context-menu">
								<button onclick={remove}><Trash2 size={16} /> 지갑 삭제</button>
							</div>{/if}
					</div>
				</div>{/snippet}
		</PageHeader>
		<section class="wallet-hero" style={`--wallet-color:${wallet.color}`}>
			<div class="hero-top">
				<span>{wallet.kind === 'xpub' ? '확장 공개키 지갑' : '단일 주소 지갑'}</span><span
					class="status-dot">관찰 중</span
				>
			</div>
			<div class="hero-balance"><strong>{formatBtc(wallet.balance)}</strong><span>BTC</span></div>
			<p>{formatSats(wallet.balance)} sats</p>
			<div class="hero-stats">
				<div><span>확정 잔액</span><strong>{formatSats(wallet.confirmedBalance)} sats</strong></div>
				<div><span>거래</span><strong>{wallet.txCount}건</strong></div>
			</div>
		</section>
		{#if syncMessage}<p class:failed={Boolean(wallet.syncError)} class="sync-message">
				{syncMessage}
			</p>{/if}

		<div class="detail-actions">
			<a href={`/wallets/${wallet.id}/addresses`}><QrCode size={20} /><span>주소 보기</span></a>
			<button onclick={copySource}
				><Copy size={20} /><span>{copied ? '복사됨' : '공개 정보 복사'}</span></button
			>
			<a
				href={wallet.network === 'mainnet'
					? `https://mempool.space/address/${addresses[0]?.address}`
					: `https://mempool.space/testnet/address/${addresses[0]?.address}`}
				target="_blank"
				rel="noreferrer"><ExternalLink size={20} /><span>탐색기</span></a
			>
		</div>

		<section class="section-block">
			<div class="section-title"><h2>공개 정보</h2></div>
			<div class="detail-panel">
				<div>
					<span>{wallet.kind === 'xpub' ? '확장 공개키' : '주소'}</span><code
						>{shortAddress(wallet.source, 14, 12)}</code
					>
				</div>
				<div><span>주소 형식</span><strong>{wallet.scriptType.replace('-', ' ')}</strong></div>
				{#if wallet.kind === 'xpub'}<div>
						<span>Descriptor</span><code
							>{shortAddress(walletDescriptor(wallet.source, wallet.scriptType), 20, 14)}</code
						>
					</div>{/if}
			</div>
		</section>

		<section class="section-block">
			<div class="section-title">
				<h2>최근 거래</h2>
				<a href="/transactions">전체 보기</a>
			</div>
			{#if transactions.length}<div class="panel">
					{#each transactions.slice(0, 5) as transaction (transaction.id)}<TransactionRow
							{transaction}
						/>{/each}
				</div>{:else}<EmptyState
					title="거래 내역이 없어요"
					description="온라인 상태에서 동기화하면 이곳에 거래 내역이 표시됩니다."
				/>{/if}
		</section>
	{:else if walletState.ready}
		<EmptyState
			title="지갑을 찾을 수 없어요"
			description="삭제되었거나 이 기기에 없는 지갑입니다."
			actionLabel="지갑 목록"
			href="/wallets"
		/>
	{/if}
</main>
