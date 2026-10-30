<script lang="ts">
	import { t } from '$lib/i18n';
	import { onMount } from 'svelte';
	import QRCode from 'qrcode';
	import { createPsbtUrEncoder } from '$lib/domain/psbt-qr';

	let { psbt }: { psbt: Uint8Array } = $props();
	let image = $state('');
	let total = $state(0);
	let current = $state(0);
	let error = $state('');

	onMount(() => {
		const encoder = createPsbtUrEncoder(psbt, 100);
		total = encoder.fragmentsLength;
		let frame = 0;
		let active = true;
		let rendering = false;

		async function render() {
			if (!active || rendering) return;
			rendering = true;
			try {
				const value = encoder.nextPart().toUpperCase();
				image = await QRCode.toDataURL(value, {
					errorCorrectionLevel: 'L',
					margin: 3,
					width: 440,
					color: { dark: '#000000', light: '#ffffff' }
				});
				frame += 1;
				current = ((frame - 1) % total) + 1;
			} catch {
				error = t('qr_generation_failed');
			} finally {
				rendering = false;
			}
		}

		void render();
		const interval = window.setInterval(render, 350);
		return () => {
			active = false;
			window.clearInterval(interval);
		};
	});
</script>

<div class="animated-qr" aria-live="off">
	{#if image}<img src={image} alt={t('psbt_qr_alt')} />{:else}<div class="qr-placeholder">
			{t('preparing_qr')}
		</div>{/if}
	<p>{error || t('animated_ur_progress', { current, total })}</p>
</div>
