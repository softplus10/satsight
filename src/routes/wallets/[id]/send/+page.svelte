<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ArrowUpRight, CheckCircle2, QrCode, ScanLine, ShieldCheck } from '@lucide/svelte';
	import AnimatedPsbtQr from '$lib/components/AnimatedPsbtQr.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import PsbtQrScanner from '$lib/components/PsbtQrScanner.svelte';
	import QrScanner from '$lib/components/QrScanner.svelte';
	import { createSpendPsbt, finalizeSignedPsbt } from '$lib/domain/send';
	import type { FinalizedSpend, PreparedSpend } from '$lib/domain/send';
	import { formatBtc, formatSats, shortAddress } from '$lib/domain/bitcoin';
	import type { Wallet, WatchedAddress } from '$lib/domain/types';
	import { openExternal } from '$lib/platform/external';
	import { walletState } from '$lib/state/wallets.svelte';
	import { broadcastTransaction, fetchFeeRate, fetchSpendUtxos } from '$lib/sync/send';

	type Step = 'form' | 'review' | 'qr' | 'broadcast';
	let wallet = $state<Wallet>();
	let addresses = $state<WatchedAddress[]>([]);
	let step = $state<Step>('form');
	let recipient = $state('');
	let amount = $state('');
	let feeRate = $state('1');
	let originText = $state('');
	let error = $state('');
	let preparing = $state(false);
	let broadcasting = $state(false);
	let originScannerOpen = $state(false);
	let signedScannerOpen = $state(false);
	let prepared = $state<PreparedSpend>();
	let finalized = $state<FinalizedSpend>();
	let broadcastedTxid = $state('');

	onMount(async () => {
		await walletState.initialize();
		wallet = walletState.wallets.find((item) => item.id === page.params.id);
		if (!wallet) return;
		addresses = await walletState.addresses(wallet.id);
		try {
			feeRate = String(await fetchFeeRate(wallet, walletState.settings));
		} catch {
			// A manually editable 1 sat/vB fallback remains available when estimates fail.
		}
	});

	async function connectOrigin(value = originText) {
		if (!wallet) return;
		error = '';
		originScannerOpen = false;
		try {
			wallet = await walletState.connectKeyOrigin(wallet.id, value);
			originText = '';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : '키 origin 정보를 연결하지 못했습니다.';
		}
	}

	async function prepare(event: SubmitEvent) {
		event.preventDefault();
		if (!wallet) return;
		error = '';
		preparing = true;
		try {
			const walletId = wallet.id;
			await walletState.syncWallet(walletId);
			wallet = walletState.wallets.find((item) => item.id === walletId);
			if (!wallet) throw new Error('지갑을 찾을 수 없습니다.');
			addresses = await walletState.addresses(wallet.id);
			const utxos = await fetchSpendUtxos(wallet, addresses, walletState.settings);
			prepared = createSpendPsbt(
				wallet,
				addresses,
				utxos,
				recipient.trim(),
				Number(amount),
				Number(feeRate)
			);
			step = 'review';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'PSBT를 만들지 못했습니다.';
		} finally {
			preparing = false;
		}
	}

	function acceptSignedPsbt(value: Uint8Array) {
		if (!prepared) return;
		error = '';
		try {
			finalized = finalizeSignedPsbt(prepared.psbt, value);
			signedScannerOpen = false;
			step = 'broadcast';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'signed PSBT를 검증하지 못했습니다.';
			signedScannerOpen = false;
		}
	}

	async function broadcast() {
		if (!wallet || !finalized || broadcasting) return;
		if (!confirm('서명된 거래를 비트코인 네트워크에 브로드캐스트할까요?')) return;
		error = '';
		broadcasting = true;
		try {
			broadcastedTxid = await broadcastTransaction(
				wallet,
				walletState.settings,
				finalized.hex,
				finalized.txid
			);
			try {
				await walletState.syncWallet(wallet.id);
			} catch {
				// Broadcast succeeded; a later sync can refresh the local snapshot.
			}
		} catch (cause) {
			error = cause instanceof Error ? cause.message : '거래를 브로드캐스트하지 못했습니다.';
		} finally {
			broadcasting = false;
		}
	}

	function openTransaction() {
		if (!wallet || !broadcastedTxid) return;
		const base =
			wallet.network === 'mainnet' ? 'https://mempool.space' : 'https://mempool.space/testnet';
		void openExternal(`${base}/tx/${broadcastedTxid}`);
	}

	function reset() {
		step = 'form';
		prepared = undefined;
		finalized = undefined;
		broadcastedTxid = '';
		error = '';
	}
</script>

<svelte:head><title>보내기 · SatSight</title></svelte:head>
<main class="page narrow send-page">
	<PageHeader
		title="비트코인 보내기"
		eyebrow={wallet?.name ?? 'CREATE PSBT'}
		back={`/wallets/${page.params.id}`}
	/>

	{#if wallet?.kind === 'address'}
		<EmptyState
			title="단일 주소 지갑에서는 보낼 수 없어요"
			description="키 경로가 포함된 계정 확장 공개키 지갑을 연결해야 PSBT를 만들 수 있습니다."
			actionLabel="지갑으로 돌아가기"
			href={`/wallets/${wallet.id}`}
		/>
	{:else if wallet && !wallet.keyOrigin}
		<section class="form-card origin-connect">
			<div class="security-note">
				<ShieldCheck size={20} />
				<div>
					<strong>서명 경로를 한 번 더 연결해 주세요</strong>
					<p>
						기존 지갑에는 fingerprint와 계정 경로가 저장되지 않았습니다. SeedSigner의 xpub export를
						다시 스캔해도 개인키는 가져오지 않습니다.
					</p>
				</div>
			</div>
			<label class="field">
				<span>[fingerprint/path]xpub</span>
				<textarea bind:value={originText} rows="4" spellcheck="false" autocapitalize="off"
				></textarea>
			</label>
			<div class="send-buttons">
				<button class="button secondary" onclick={() => (originScannerOpen = true)}
					><ScanLine size={17} /> QR 스캔</button
				>
				<button class="button primary" onclick={() => connectOrigin()} disabled={!originText.trim()}
					>연결</button
				>
			</div>
			{#if error}<p class="form-error" role="alert">{error}</p>{/if}
		</section>
	{:else if wallet && step === 'form'}
		<form class="form-card" onsubmit={prepare}>
			<label class="field">
				<span>받는 주소</span>
				<textarea
					bind:value={recipient}
					rows="3"
					spellcheck="false"
					autocapitalize="off"
					placeholder={wallet.network === 'mainnet' ? 'bc1…' : 'tb1…'}
				></textarea>
			</label>
			<label class="field">
				<span>보낼 금액 (sats)</span>
				<input
					bind:value={amount}
					type="number"
					min="1"
					step="1"
					inputmode="numeric"
					placeholder="0"
				/>
				<small
					>{amount && Number(amount) > 0
						? `${formatBtc(Number(amount))} BTC`
						: `확정 잔액 ${formatSats(wallet.confirmedBalance)} sats`}</small
				>
			</label>
			<label class="field">
				<span>수수료율 (sat/vB)</span>
				<input
					bind:value={feeRate}
					type="number"
					min="1"
					max="10000"
					step="1"
					inputmode="numeric"
				/>
				<small>Esplora의 약 3블록 확인 목표 추정값입니다. 필요하면 직접 조정할 수 있습니다.</small>
			</label>
			<div class="security-note">
				<ShieldCheck size={20} />
				<div>
					<strong>앱은 서명하지 않습니다</strong>
					<p>PSBT만 만들며 최종 주소와 금액은 SeedSigner 화면에서도 반드시 확인하세요.</p>
				</div>
			</div>
			{#if error}<p class="form-error" role="alert">{error}</p>{/if}
			<button class="button primary full" disabled={preparing}
				>{preparing ? 'UTXO 동기화 및 준비 중…' : 'PSBT 만들기'}</button
			>
		</form>
	{:else if prepared && step === 'review'}
		<section class="send-stage">
			<div class="send-summary">
				<h2>PSBT 내용 확인</h2>
				<div><span>받는 주소</span><code>{shortAddress(prepared.recipient, 14, 12)}</code></div>
				<div><span>보낼 금액</span><strong>{formatSats(prepared.amount)} sats</strong></div>
				<div><span>네트워크 수수료</span><strong>{formatSats(prepared.fee)} sats</strong></div>
				<div><span>수수료율</span><strong>{prepared.feeRate} sat/vB</strong></div>
				<div><span>선택된 입력</span><strong>{prepared.inputCount}개</strong></div>
				<div><span>Change</span><strong>{formatSats(prepared.change)} sats</strong></div>
			</div>
			<p class="footnote">
				이 정보와 SeedSigner가 보여주는 주소·금액·수수료가 모두 같은지 확인하세요.
			</p>
			<div class="send-buttons">
				<button class="button secondary" onclick={reset}>수정</button>
				<button class="button primary" onclick={() => (step = 'qr')}
					><QrCode size={17} /> 서명 QR 열기</button
				>
			</div>
		</section>
	{:else if prepared && step === 'qr'}
		<section class="send-stage">
			<div class="send-instructions">
				<strong>1. SeedSigner에서 Scan을 선택하세요.</strong>
				<p>
					아래 animated PSBT QR 전체를 스캔하고 SeedSigner 화면에서 거래 내용을 검토한 뒤
					서명하세요.
				</p>
			</div>
			<AnimatedPsbtQr psbt={prepared.psbt} />
			<div class="send-instructions">
				<strong>2. 서명된 QR을 앱으로 가져오세요.</strong>
				<p>SeedSigner가 표시하는 signed transaction animated QR을 스캔합니다.</p>
			</div>
			{#if error}<p class="form-error" role="alert">{error}</p>{/if}
			<div class="send-buttons">
				<button class="button secondary" onclick={() => (step = 'review')}>이전</button>
				<button class="button primary" onclick={() => (signedScannerOpen = true)}
					><ScanLine size={17} /> signed PSBT 스캔</button
				>
			</div>
		</section>
	{:else if finalized && step === 'broadcast'}
		<section class="send-stage">
			{#if broadcastedTxid}
				<div class="broadcast-success">
					<CheckCircle2 size={38} />
					<h2>거래를 전송했습니다</h2>
					<code>{shortAddress(broadcastedTxid, 16, 16)}</code>
				</div>
				<div class="send-buttons">
					<button class="button secondary" onclick={() => goto(`/wallets/${wallet?.id}`)}
						>지갑으로</button
					>
					<button class="button primary" onclick={openTransaction}
						><ArrowUpRight size={17} /> 탐색기</button
					>
				</div>
			{:else}
				<div class="send-summary">
					<h2>서명 검증 완료</h2>
					<div><span>txid</span><code>{shortAddress(finalized.txid, 14, 12)}</code></div>
					<div><span>최종 수수료</span><strong>{formatSats(finalized.fee)} sats</strong></div>
				</div>
				<div class="security-note">
					<ShieldCheck size={20} />
					<div>
						<strong>원본 PSBT와 일치합니다</strong>
						<p>입력, 받는 주소와 금액이 바뀌지 않았고 모든 입력의 서명이 완성되었습니다.</p>
					</div>
				</div>
				{#if error}<p class="form-error" role="alert">{error}</p>{/if}
				<div class="send-buttons">
					<button class="button secondary" onclick={() => (step = 'qr')}>다시 스캔</button>
					<button class="button primary" onclick={broadcast} disabled={broadcasting}
						>{broadcasting ? '브로드캐스트 중…' : '네트워크에 전송'}</button
					>
				</div>
			{/if}
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

{#if originScannerOpen}<QrScanner
		onResult={connectOrigin}
		onClose={() => (originScannerOpen = false)}
	/>{/if}
{#if signedScannerOpen}<PsbtQrScanner
		onResult={acceptSignedPsbt}
		onClose={() => (signedScannerOpen = false)}
	/>{/if}
