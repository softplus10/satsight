<script lang="ts">
	import { ArrowDownLeft, ArrowUpRight, RefreshCw } from '@lucide/svelte';
	import { formatSats, shortAddress } from '$lib/domain/bitcoin';
	import type { WalletTransaction } from '$lib/domain/types';
	let { transaction }: { transaction: WalletTransaction } = $props();
	const label = $derived(
		transaction.direction === 'received'
			? '받음'
			: transaction.direction === 'sent'
				? '보냄'
				: '내부 이동'
	);
	const Icon = $derived(
		transaction.direction === 'received'
			? ArrowDownLeft
			: transaction.direction === 'sent'
				? ArrowUpRight
				: RefreshCw
	);
	const date = $derived(
		new Intl.DateTimeFormat('ko-KR', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(transaction.firstSeen * 1000)
	);
</script>

<a class="transaction-row" href={`/transactions/${transaction.id}`}>
	<div class:received={transaction.direction === 'received'} class="tx-icon">
		<Icon size={19} />
	</div>
	<div class="tx-main">
		<strong>{transaction.note || label}</strong><span
			>{date} · {shortAddress(transaction.txid, 6, 6)}</span
		>
	</div>
	<div class:positive={transaction.direction === 'received'} class="tx-value">
		<strong
			>{transaction.direction === 'received'
				? '+'
				: transaction.direction === 'sent'
					? '−'
					: ''}{formatSats(Math.abs(transaction.value))}</strong
		>
		<span>sats · {transaction.status === 'confirmed' ? '확정' : '대기'}</span>
	</div>
</a>
