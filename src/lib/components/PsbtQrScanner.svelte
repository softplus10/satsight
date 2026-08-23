<script lang="ts">
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
			return '카메라 권한이 거부되었습니다. 시스템 설정에서 SatSight의 카메라 접근을 허용해 주세요.';
		}
		if (cause instanceof DOMException && cause.name === 'NotFoundError') {
			return '사용할 수 있는 카메라를 찾지 못했습니다.';
		}
		return '카메라를 시작하지 못했습니다. 권한과 다른 앱의 카메라 사용 여부를 확인해 주세요.';
	}

	async function start() {
		controls?.stop();
		error = '';
		scanError = '';
		starting = true;
		if (!navigator.mediaDevices?.getUserMedia) {
			error = '이 환경에서는 카메라 스캔을 지원하지 않습니다.';
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
				<p>SIGNED TRANSACTION</p>
				<h2 id="psbt-scanner-title">서명된 PSBT 스캔</h2>
			</div>
			<button onclick={onClose} aria-label="스캐너 닫기"><X size={22} /></button>
		</header>
		<div class="camera-preview">
			<video bind:this={video} muted playsinline></video>
			<div class="scan-frame"><i></i><i></i><i></i><i></i><span></span></div>
			{#if segmentProgress}
				<div class="segment-progress" role="status" aria-live="polite">
					<div><strong>signed PSBT 수집 중</strong><b>{segmentProgress.percent}%</b></div>
					<div
						class="segment-progress-track"
						role="progressbar"
						aria-label="signed PSBT 수집 진행률"
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow={segmentProgress.percent}
					>
						<span style:width={`${segmentProgress.percent}%`}></span>
					</div>
					<small>{segmentProgress.received} / {segmentProgress.total} 세그먼트</small>
				</div>
			{/if}
			{#if starting}
				<div class="camera-state">
					<RotateCw class="spinning" size={27} /><strong>카메라 권한 요청 중…</strong>
				</div>
			{/if}
			{#if error}
				<div class="camera-state error">
					<Camera size={28} /><strong>카메라를 열 수 없어요</strong>
					<p>{error}</p>
					<button class="button secondary" onclick={start}>다시 시도</button>
				</div>
			{/if}
			{#if scanError}
				<div class="camera-state error">
					<Camera size={28} /><strong>signed PSBT를 읽을 수 없어요</strong>
					<p>{scanError}</p>
					<button class="button secondary" onclick={restartScan}>처음부터 다시 스캔</button>
				</div>
			{/if}
		</div>
		<p class="scanner-help">
			SeedSigner의 signed transaction animated QR을 완료될 때까지 비춰 주세요.
		</p>
	</div>
</div>
