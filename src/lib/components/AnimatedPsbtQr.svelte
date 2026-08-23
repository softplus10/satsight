<script lang="ts">
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
				error = 'PSBT QR 이미지를 만들지 못했습니다.';
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
	{#if image}<img src={image} alt="SeedSigner가 스캔할 animated PSBT QR" />{:else}<div
			class="qr-placeholder"
		>
			QR 준비 중…
		</div>{/if}
	<p>{error || `Animated UR · ${current} / ${total}`}</p>
</div>
