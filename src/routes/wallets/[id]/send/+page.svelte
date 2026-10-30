<script lang="ts">
	import { t, localizedHref } from '$lib/i18n';
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
			error = cause instanceof Error ? cause.message : t('key_origin_connect_failed');
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
			if (!wallet) throw new Error(t('wallet_not_found'));
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
			error = cause instanceof Error ? cause.message : t('psbt_creation_failed');
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
			error = cause instanceof Error ? cause.message : t('psbt_validation_failed');
			signedScannerOpen = false;
		}
	}

	async function broadcast() {
		if (!wallet || !finalized || broadcasting) return;
		if (!confirm(t('broadcast_confirm'))) return;
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
			error = cause instanceof Error ? cause.message : t('broadcast_failed');
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

<svelte:head><title>{t('page_title', { title: t('send') })}</title></svelte:head>
<main class="page narrow send-page">
	<PageHeader
		title={t('send_bitcoin')}
		subtitle={wallet?.name}
		back={`/wallets/${page.params.id}`}
	/>

	{#if wallet?.kind === 'address'}
		<EmptyState
			title={t('sending_requires_an_extended_public_key')}
			description={t('send_public_key_help')}
			actionLabel={t('back_to_wallet')}
			href={localizedHref(`/wallets/${wallet.id}`)}
		/>
	{:else if wallet && !wallet.keyOrigin}
		<section class="form-card origin-connect">
			<div class="security-note">
				<ShieldCheck size={20} />
				<div>
					<strong>{t('connect_key_origin')}</strong>
					<p>
						{t('key_origin_help')}
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
					><ScanLine size={17} /> {t('scan_qr')}</button
				>
				<button class="button primary" onclick={() => connectOrigin()} disabled={!originText.trim()}
					>{t('connect')}</button
				>
			</div>
			{#if error}<p class="form-error" role="alert">{error}</p>{/if}
		</section>
	{:else if wallet && step === 'form'}
		<form class="form-card" onsubmit={prepare}>
			<label class="field">
				<span>{t('recipient_address')}</span>
				<textarea
					bind:value={recipient}
					rows="3"
					spellcheck="false"
					autocapitalize="off"
					placeholder={wallet.network === 'mainnet' ? 'bc1…' : 'tb1…'}
				></textarea>
			</label>
			<label class="field">
				<span>{t('amount_sats')}</span>
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
						: t('confirmed_balance_sats', { balance: formatSats(wallet.confirmedBalance) })}</small
				>
			</label>
			<label class="field">
				<span>{t('fee_rate_sat_vb')}</span>
				<input
					bind:value={feeRate}
					type="number"
					min="1"
					max="10000"
					step="1"
					inputmode="numeric"
				/>
				<small>{t('fee_estimate_help')}</small>
			</label>
			<div class="security-note">
				<ShieldCheck size={20} />
				<div>
					<strong>{t('external_signing_required')}</strong>
					<p>{t('verify_signer_help')}</p>
				</div>
			</div>
			{#if error}<p class="form-error" role="alert">{error}</p>{/if}
			<button class="button primary full" disabled={preparing}
				>{preparing ? t('preparing_psbt') : t('create_psbt')}</button
			>
		</form>
	{:else if prepared && step === 'review'}
		<section class="send-stage">
			<div class="send-summary">
				<h2>{t('review_transaction')}</h2>
				<div><span>{t('recipient_address')}</span><code>{prepared.recipient}</code></div>
				<div><span>{t('amount')}</span><strong>{formatSats(prepared.amount)} sats</strong></div>
				<div><span>{t('network_fee')}</span><strong>{formatSats(prepared.fee)} sats</strong></div>
				<div><span>{t('fee_rate')}</span><strong>{prepared.feeRate} sat/vB</strong></div>
				<div><span>{t('inputs')}</span><strong>{prepared.inputCount}</strong></div>
				<div><span>{t('change')}</span><strong>{formatSats(prepared.change)} sats</strong></div>
			</div>
			<p class="footnote">
				{t('verify_seedsigner_help')}
			</p>
			<div class="send-buttons">
				<button class="button secondary" onclick={reset}>{t('edit')}</button>
				<button class="button primary" onclick={() => (step = 'qr')}
					><QrCode size={17} /> {t('show_signing_qr')}</button
				>
			</div>
		</section>
	{:else if prepared && step === 'qr'}
		<section class="send-stage">
			<div class="send-instructions">
				<strong>{t('scan_with_seedsigner_step')}</strong>
				<p>
					{t('seedsigner_sign_help')}
				</p>
			</div>
			<AnimatedPsbtQr psbt={prepared.psbt} />
			<div class="send-instructions">
				<strong>{t('import_signed_psbt_step')}</strong>
				<p>{t('import_signed_psbt_help')}</p>
			</div>
			{#if error}<p class="form-error" role="alert">{error}</p>{/if}
			<div class="send-buttons">
				<button class="button secondary" onclick={() => (step = 'review')}>{t('back')}</button>
				<button class="button primary" onclick={() => (signedScannerOpen = true)}
					><ScanLine size={17} /> {t('scan_signed_psbt')}</button
				>
			</div>
		</section>
	{:else if finalized && step === 'broadcast'}
		<section class="send-stage">
			{#if broadcastedTxid}
				<div class="broadcast-success">
					<CheckCircle2 size={38} />
					<h2>{t('transaction_broadcast')}</h2>
					<code>{shortAddress(broadcastedTxid, 16, 16)}</code>
				</div>
				<div class="send-buttons">
					<button
						class="button secondary"
						onclick={() => goto(localizedHref(`/wallets/${wallet?.id}`))}
						>{t('back_to_wallet')}</button
					>
					<button class="button primary" onclick={openTransaction}
						><ArrowUpRight size={17} /> {t('explorer')}</button
					>
				</div>
			{:else}
				<div class="send-summary">
					<h2>{t('psbt_finalized')}</h2>
					<div><span>txid</span><code>{shortAddress(finalized.txid, 14, 12)}</code></div>
					<div><span>{t('final_fee')}</span><strong>{formatSats(finalized.fee)} sats</strong></div>
				</div>
				<div class="security-note">
					<ShieldCheck size={20} />
					<div>
						<strong>{t('matches_the_original_psbt')}</strong>
						<p>{t('psbt_finalized_help')}</p>
					</div>
				</div>
				{#if error}<p class="form-error" role="alert">{error}</p>{/if}
				<div class="send-buttons">
					<button class="button secondary" onclick={() => (step = 'qr')}>{t('scan_again')}</button>
					<button class="button primary" onclick={broadcast} disabled={broadcasting}
						>{broadcasting ? t('broadcasting') : t('broadcast_transaction')}</button
					>
				</div>
			{/if}
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

{#if originScannerOpen}<QrScanner
		onResult={connectOrigin}
		onClose={() => (originScannerOpen = false)}
	/>{/if}
{#if signedScannerOpen}<PsbtQrScanner
		onResult={acceptSignedPsbt}
		onClose={() => (signedScannerOpen = false)}
	/>{/if}
