<script lang="ts">
	import { t } from '$lib/i18n';
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
				>{wallet.network === 'mainnet' ? t('mainnet') : t('testnet')}</span
			>
		</div>
		<p>
			{wallet.kind === 'xpub' ? t('extended_public_key') : t('single_address')} · {t(
				'transaction_count',
				{ count: wallet.txCount }
			)}
		</p>
	</div>
	<div class="wallet-value">
		<strong>{formatBtc(wallet.balance)} BTC</strong>
		<small>{formatSats(wallet.balance)} sats</small>
	</div>
	<ChevronRight class="chevron" size={18} />
</a>
