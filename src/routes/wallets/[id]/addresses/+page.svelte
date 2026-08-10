<script lang="ts">
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

<svelte:head><title>주소 · SatSight</title></svelte:head>
<main class="page narrow">
	<PageHeader
		title="주소"
		eyebrow={wallet?.name ?? 'WATCHED ADDRESSES'}
		back={`/wallets/${page.params.id}`}
	/>
	<div class="tab-row"><button class="active">받는 주소</button><button>거스름 주소</button></div>
	<div class="address-list">
		{#each addresses.filter((item) => item.branch === 0) as item (item.id)}
			<div class="address-card">
				<div class="address-index">{item.index + 1}</div>
				<div>
					<strong>{item.label}</strong><code>{shortAddress(item.address, 12, 12)}</code><span
						class:used={item.used}>{item.used ? '사용됨' : '미사용'} · {item.txCount}건</span
					>
				</div>
				<button onclick={() => copy(item.address)} aria-label="주소 복사"
					>{#if copied === item.address}<Check size={18} />{:else}<Copy size={18} />{/if}</button
				>
			</div>
		{/each}
	</div>
	<p class="footnote">
		주소는 공개키에서 이 기기 안에서 파생됩니다. 개인키나 서명 권한은 저장되지 않습니다.
	</p>
</main>
