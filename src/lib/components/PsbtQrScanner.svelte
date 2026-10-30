<script lang="ts">
	import { t } from '$lib/i18n';
	import { onMount } from 'svelte';
	import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
	import { Camera, RotateCw, X } from '@lucide/svelte';
	import { PsbtQrCollector } from '$lib/domain/psbt-qr';
	import type { QrSegmentProgress } from '$lib/domain/qr-segments';

	let { onResult, onClose }: { onResult: (value: Uint8Array) => void; onClose: () => void } =
		$props();
	let video: HTMLVideoElement;
	let controls: IScannerControls | undefined;
	let starting = $state(true);
	let error = $state('');
	let scanError = $state('');
	let segmentProgress = $state<QrSegmentProgress>();
	let disposed = false;
	const collector = new PsbtQrCollector();

	function permissionError(cause: unknown) {
		if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
			return t('camera_permission_denied');
		}
		if (cause instanceof DOMException && cause.name === 'NotFoundError') {
			return t('no_camera_found');
		}
		return t('camera_start_failed');
	}

	async function start() {
		controls?.stop();
		error = '';
		scanError = '';
		starting = true;
		if (!navigator.mediaDevices?.getUserMedia) {
			error = t('camera_unsupported');
			starting = false;
			return;
		}
		try {
			const reader = new BrowserQRCodeReader(undefined, {
				delayBetweenScanAttempts: 180,
				delayBetweenScanSuccess: 350
			});
			const scanner = await reader.decodeFromConstraints(
				{
					audio: false,
					video: {
						facingMode: { ideal: 'environment' },
						width: { ideal: 1280 },
						height: { ideal: 720 }
					}
				},
				video,
				(result) => {
					if (!result || disposed) return;
					const scanned = collector.add(result.getText());
					segmentProgress = scanned.progress;
					if (scanned.error) {
						scanner.stop();
						scanError = scanned.error;
						return;
					}
					if (!scanned.psbt) return;
					scanner.stop();
					onResult(scanned.psbt);
				}
			);
			if (disposed) scanner.stop();
			else controls = scanner;
		} catch (cause) {
			error = permissionError(cause);
		} finally {
			starting = false;
		}
	}

	function restartScan() {
		collector.reset();
		segmentProgress = undefined;
		scanError = '';
		void start();
	}

	onMount(() => {
		void start();
		return () => {
			disposed = true;
			controls?.stop();
		};
	});
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />
<div class="scanner-backdrop" role="dialog" aria-modal="true" aria-labelledby="psbt-scanner-title">
	<div class="scanner-modal">
		<header>
			<div>
				<h2 id="psbt-scanner-title">{t('scan_signed_psbt')}</h2>
			</div>
			<button onclick={onClose} aria-label={t('close_scanner')}><X size={22} /></button>
		</header>
		<div class="camera-preview">
			<video bind:this={video} muted playsinline></video>
			<div class="scan-frame"><i></i><i></i><i></i><i></i><span></span></div>
			{#if segmentProgress}
				<div class="segment-progress" role="status" aria-live="polite">
					<div><strong>{t('collecting_signed_psbt')}</strong><b>{segmentProgress.percent}%</b></div>
					<div
						class="segment-progress-track"
						role="progressbar"
						aria-label={t('signed_psbt_scan_progress')}
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow={segmentProgress.percent}
					>
						<span style:width={`${segmentProgress.percent}%`}></span>
					</div>
					<small
						>{t('qr_frame_progress', {
							received: segmentProgress.received,
							total: segmentProgress.total
						})}</small
					>
				</div>
			{/if}
			{#if starting}
				<div class="camera-state">
					<RotateCw class="spinning" size={27} /><strong>{t('starting_camera')}</strong>
				</div>
			{/if}
			{#if error}
				<div class="camera-state error">
					<Camera size={28} /><strong>{t('camera_unavailable')}</strong>
					<p>{error}</p>
					<button class="button secondary" onclick={start}>{t('try_again')}</button>
				</div>
			{/if}
			{#if scanError}
				<div class="camera-state error">
					<Camera size={28} /><strong>{t('signed_psbt_scan_failed')}</strong>
					<p>{scanError}</p>
					<button class="button secondary" onclick={restartScan}>{t('restart_scan')}</button>
				</div>
			{/if}
		</div>
		<p class="scanner-help">
			{t('signed_psbt_scan_help')}
		</p>
	</div>
</div>
