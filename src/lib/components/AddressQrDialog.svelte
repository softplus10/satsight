<script lang="ts">
	import { onMount } from 'svelte';
	import { Check, Copy, RotateCw, X } from '@lucide/svelte';
	import QRCode from 'qrcode';
	import { t } from '$lib/i18n';

	let {
		title,
		address,
		description,
		loading = false,
		error = '',
		onClose,
		onRetry
	}: {
		title: string;
		address?: string;
		description?: string;
		loading?: boolean;
		error?: string;
		onClose: () => void;
		onRetry?: () => void;
	} = $props();
	let dialog: HTMLDialogElement;
	let image = $state('');
	let qrError = $state('');
	let copied = $state(false);
	let copyError = $state('');

	onMount(() => dialog.showModal());
	$effect(() => {
		image = '';
		qrError = '';
		copied = false;
		copyError = '';
		if (!address) return;
		let cancelled = false;
		// Encode the full address, never the shortened text used in list rows.
		QRCode.toDataURL(address, {
			errorCorrectionLevel: 'M',
			margin: 3,
			width: 400,
			color: { dark: '#000000', light: '#ffffff' }
		})
			.then((value) => {
				if (!cancelled) image = value;
			})
			.catch(() => {
				if (!cancelled) qrError = t('address_qr_failed');
			});
		return () => {
			cancelled = true;
		};
	});

	async function copy() {
		if (!address) return;
		try {
			await navigator.clipboard.writeText(address);
			copied = true;
			copyError = '';
		} catch {
			copyError = t('address_copy_failed');
		}
	}
</script>

<dialog
	bind:this={dialog}
	class="address-qr-dialog"
	aria-labelledby="address-qr-title"
	onclose={onClose}
>
	<header>
		<h2 id="address-qr-title">{title}</h2>
		<button class="icon-button" onclick={() => dialog.close()} aria-label={t('close')}
			><X size={20} /></button
		>
	</header>
	{#if loading}
		<p class="qr-dialog-loading" role="status">
			<RotateCw class="spinning" size={20} />{t('checking_receive_address')}
		</p>
	{:else if error}
		<p class="form-error" role="alert">{error}</p>
		{#if onRetry}<button class="button secondary full" onclick={onRetry}>{t('try_again')}</button
			>{/if}
	{:else if address}
		{#if description}<p class="footnote">{description}</p>{/if}
		{#if image}<img class="address-qr-image" src={image} alt={t('address_qr_alt', { address })} />
		{:else if !qrError}<p role="status">{t('preparing_qr')}</p>{/if}
		{#if qrError}<p class="form-error" role="alert">{qrError}</p>{/if}
		<code class="full-address">{address}</code>
		<button class="button primary full" onclick={copy}>
			{#if copied}<Check size={18} />{t('copied')}{:else}<Copy size={18} />{t('copy_address')}{/if}
		</button>
		{#if copyError}<p class="form-error" role="alert">{copyError}</p>{/if}
	{/if}
</dialog>
