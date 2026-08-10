<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import { formatBtc, formatSats } from '$lib/domain/bitcoin';
	import type { Wallet } from '$lib/domain/types';
	let { wallet, compact = false }: { wallet: Wallet; compact?: boolean } = $props();
</script>

<a class:compact class="wallet-card" href={`/wallets/${wallet.id}`}>
	<div class="wallet-icon" style={`--wallet-color:${wallet.color}`}><span></span></div>
	<div class="wallet-main">
		<div class="wallet-name">
			<strong>{wallet.name}</strong><span class="network"
				>{wallet.network === 'mainnet' ? 'MAINNET' : 'TESTNET'}</span
			>
		</div>
		<p>{wallet.kind === 'xpub' ? '확장 공개키' : '단일 주소'} · {wallet.txCount}건</p>
	</div>
	<div class="wallet-value">
		<strong>{formatBtc(wallet.balance)} BTC</strong>
		<small>{formatSats(wallet.balance)} sats</small>
	</div>
	<ChevronRight class="chevron" size={18} />
</a>
