<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import WalletCard from '$lib/components/WalletCard.svelte';
	import { walletState } from '$lib/state/wallets.svelte';
</script>

<svelte:head><title>지갑 · SatSight</title></svelte:head>
<main class="page">
	<PageHeader title="지갑" eyebrow="PORTFOLIO">
		{#snippet action()}<a class="button small primary" href="/wallets/new"
				><Plus size={17} /> 추가</a
			>{/snippet}
	</PageHeader>
	{#if walletState.wallets.length}
		<div class="wallet-list">
			{#each walletState.wallets as wallet (wallet.id)}<WalletCard {wallet} />{/each}
		</div>
		<div class="info-strip">
			<span>i</span>
			<p>
				SatSight는 공개 정보만 저장합니다. PSBT는 SeedSigner 같은 외부 서명 장치에서 승인하며, 이
				앱은 개인키에 접근하지 않습니다.
			</p>
		</div>
	{:else if walletState.ready}
		<EmptyState
			title="아직 지갑이 없어요"
			description="비트코인 주소 또는 계정 확장 공개키를 추가하세요. 모든 정보는 이 기기에만 저장됩니다."
			actionLabel="첫 지갑 추가"
			href="/wallets/new"
		/>
	{/if}
</main>
