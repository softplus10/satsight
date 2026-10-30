<script lang="ts">
	import { t } from '$lib/i18n';
	import { scriptTypeLabel } from '$lib/i18n/address-label';
	import { goto } from '$app/navigation';
	import { KeyRound, MapPin, ScanLine, ShieldCheck } from '@lucide/svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import QrScanner from '$lib/components/QrScanner.svelte';
	import { parseWalletQr, sourceError } from '$lib/domain/bitcoin';
	import type { BitcoinNetwork, KeyOrigin, ScriptType, WalletKind } from '$lib/domain/types';
	import { walletState } from '$lib/state/wallets.svelte';

	let name = $state('');
	let kind = $state<WalletKind>('xpub');
	let network = $state<BitcoinNetwork>('mainnet');
	let scriptType = $state<ScriptType>('native-segwit');
	let source = $state('');
	let keyOrigin = $state<KeyOrigin>();
	let error = $state('');
	let saving = $state(false);
	let scannerOpen = $state(false);

	function importQr(value: string) {
		const parsed = parseWalletQr(value);
		scannerOpen = false;
		if (!parsed) {
			error = t('unsupported_wallet_qr');
			return;
		}
		kind = parsed.kind;
		network = parsed.network;
		scriptType = parsed.scriptType;
		source = parsed.source;
		keyOrigin = parsed.keyOrigin;
		if (!name) name = t('imported_wallet');
		error = '';
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		if (!name.trim()) return (error = t('wallet_name_required'));
		const validationError = sourceError(source, kind, network);
		if (validationError) return (error = validationError);
		saving = true;
		try {
			const wallet = await walletState.addWallet({
				name,
				kind,
				network,
				scriptType,
				source,
				keyOrigin
			});
			await goto(`/wallets/${wallet.id}`);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : t('wallet_save_failed');
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>{t('page_title', { title: t('add_wallet') })}</title></svelte:head>
<main class="page narrow">
	<PageHeader title={t('add_wallet')} back="/wallets">
		{#snippet action()}<button class="button small secondary" onclick={() => (scannerOpen = true)}
				><ScanLine size={17} /> {t('scan_qr')}</button
			>{/snippet}
	</PageHeader>
	<form class="form-card" onsubmit={submit}>
		<fieldset class="source-picker">
			<legend>{t('wallet_type')}</legend>
			<button
				type="button"
				class:active={kind === 'xpub'}
				onclick={() => {
					kind = 'xpub';
					source = '';
					keyOrigin = undefined;
					error = '';
				}}
				><KeyRound size={21} /><span
					><strong>{t('extended_public_key')}</strong><small
						>{t('track_receive_and_change_addresses')}</small
					></span
				></button
			>
			<button
				type="button"
				class:active={kind === 'address'}
				onclick={() => {
					kind = 'address';
					source = '';
					keyOrigin = undefined;
					error = '';
				}}
				><MapPin size={21} /><span
					><strong>{t('single_address')}</strong><small>{t('track_one_address')}</small></span
				></button
			>
		</fieldset>

		<label class="field"
			><span>{t('wallet_name')}</span><input
				bind:value={name}
				placeholder={t('cold_wallet')}
				maxlength="40"
				autocomplete="off"
			/></label
		>
		<div class="field">
			<span>{t('network')}</span>
			<div class="segmented">
				<button
					type="button"
					class:active={network === 'mainnet'}
					onclick={() => (network = 'mainnet')}>{t('mainnet')}</button
				><button
					type="button"
					class:active={network === 'testnet'}
					onclick={() => (network = 'testnet')}>{t('testnet')}</button
				>
			</div>
		</div>

		{#if kind === 'xpub'}
			<label class="field"
				><span>{t('address_type')}</span><select bind:value={scriptType}
					><option value="native-segwit">{scriptTypeLabel('native-segwit')}</option><option
						value="nested-segwit">{scriptTypeLabel('nested-segwit')}</option
					><option value="taproot">{scriptTypeLabel('taproot')}</option><option value="legacy"
						>{scriptTypeLabel('legacy')}</option
					></select
				></label
			>
		{/if}

		<label class="field"
			><span
				>{kind === 'xpub'
					? network === 'mainnet'
						? 'xpub / ypub / zpub'
						: 'tpub / upub / vpub'
					: t('bitcoin_address')}</span
			><textarea
				bind:value={source}
				oninput={() => (keyOrigin = undefined)}
				rows="4"
				spellcheck="false"
				autocapitalize="off"
				placeholder={kind === 'xpub'
					? `${network === 'mainnet' ? 'xpub / ypub / zpub' : 'tpub / upub / vpub'}...`
					: network === 'mainnet'
						? 'bc1q...'
						: 'tb1q...'}
			></textarea><small
				>{kind === 'xpub' ? t('account_public_key_help') : t('single_address_help')}</small
			></label
		>

		<div class="security-note">
			<ShieldCheck size={20} />
			<div>
				<strong>{t('do_not_enter_private_keys')}</strong>
				<p>{t('public_keys_only_help')}</p>
			</div>
		</div>
		{#if error}<p class="form-error" role="alert">{error}</p>{/if}
		<button class="button primary full" disabled={saving}
			>{saving ? t('saving') : t('add_wallet')}</button
		>
	</form>
</main>
{#if scannerOpen}<QrScanner onResult={importQr} onClose={() => (scannerOpen = false)} />{/if}
