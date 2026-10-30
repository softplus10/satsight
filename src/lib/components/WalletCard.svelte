<script lang="ts">
	import { t, localizedHref } from '$lib/i18n';
	import { ChevronRight } from '@lucide/svelte';
	import { formatBtc, formatSats } from '$lib/domain/bitcoin';
	import { walletSignatureLabel, walletScriptLabel } from '$lib/i18n/wallet-label';
	import type { Wallet } from '$lib/domain/types';
	let {
		wallet,
		compact = false,
		hideAmounts = false
	}: { wallet: Wallet; compact?: boolean; hideAmounts?: boolean } = $props();
</script>

<a class:compact class="wallet-card" href={localizedHref(`/wallets/${wallet.id}`)}>
	<div class="wallet-icon" style={`--wallet-color:${wallet.color}`}><span></span></div>
	<div class="wallet-main">
		<div class="wallet-name">
			<strong>{wallet.name}</strong><span class="network"
				>{wallet.network === 'mainnet' ? t('mainnet') : t('testnet')}</span
			>
		</div>
		<p class="wallet-type">
			<span>{walletSignatureLabel(wallet)}</span><span>{walletScriptLabel(wallet)}</span>
		</p>
		<p class="wallet-transaction-count">{t('transaction_count', { count: wallet.txCount })}</p>
	</div>
	<div class="wallet-value">
		<strong>{hideAmounts ? '••••••' : formatBtc(wallet.balance)} BTC</strong>
		<small>{hideAmounts ? '••••••' : formatSats(wallet.balance)} sats</small>
	</div>
	<ChevronRight class="chevron" size={18} />
</a>
