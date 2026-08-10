<script lang="ts">
	import { ArrowUpRight, Eye, Plus, RotateCw, ShieldCheck } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import TransactionRow from '$lib/components/TransactionRow.svelte';
	import WalletCard from '$lib/components/WalletCard.svelte';
	import { formatBtc, formatSats } from '$lib/domain/bitcoin';
	import { walletState } from '$lib/state/wallets.svelte';

	let hidden = $state(false);
	let syncing = $state(false);

	async function refresh() {
		syncing = true;
		await walletState.initialize();
		setTimeout(() => (syncing = false), 450);
	}
</script>

<svelte:head><title>홈 · SatSight</title></svelte:head>

<main class="page dashboard">
	<header class="dashboard-header">
		<div>
			<p class="eyebrow">WATCH ONLY WALLET</p>
			<h1>안녕하세요.</h1>
		</div>
		<button class="icon-button" class:spinning={syncing} onclick={refresh} aria-label="새로 고침"
			><RotateCw size={20} /></button
		>
	</header>

	<section class="balance-card">
		<div class="balance-label">
			<span>전체 잔액</span><button onclick={() => (hidden = !hidden)} aria-label="잔액 숨기기"
				><Eye size={17} /></button
			>
		</div>
		<div class="balance-value">
			{hidden ? '••••••••' : formatBtc(walletState.totalBalance)} <span>BTC</span>
		</div>
		<p>{hidden ? '••••••' : formatSats(walletState.totalBalance)} sats</p>
		<div class="balance-footer">
			<span><ShieldCheck size={15} /> 키 없이 안전하게 관찰 중</span><span
				>{walletState.wallets.length}개 지갑</span
			>
		</div>
	</section>

	<section class="quick-actions">
		<a href="/wallets/new"><span><Plus size={21} /></span><strong>지갑 추가</strong></a>
		<a href="/transactions"><span><ArrowUpRight size={21} /></span><strong>거래 내역</strong></a>
	</section>

	<section class="section-block">
		<div class="section-title">
			<h2>내 지갑</h2>
			<a href="/wallets">전체 보기</a>
		</div>
		{#if walletState.wallets.length}
			<div class="card-list">
				{#each walletState.wallets.slice(0, 3) as wallet (wallet.id)}<WalletCard
						{wallet}
						compact
					/>{/each}
			</div>
		{:else if walletState.ready}
			<EmptyState
				title="첫 지갑을 연결해보세요"
				description="주소나 확장 공개키를 추가하면 비밀키 없이 잔액을 확인할 수 있어요."
				actionLabel="Watch Wallet 추가"
				href="/wallets/new"
			/>
		{:else}
			<div class="skeleton-list"><i></i><i></i></div>
		{/if}
	</section>

	{#if walletState.transactions.length}
		<section class="section-block">
			<div class="section-title">
				<h2>최근 거래</h2>
				<a href="/transactions">전체 보기</a>
			</div>
			<div class="panel">
				{#each walletState.transactions.slice(0, 4) as transaction (transaction.id)}<TransactionRow
						{transaction}
					/>{/each}
			</div>
		</section>
	{/if}
</main>
