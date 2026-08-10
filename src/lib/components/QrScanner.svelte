<script lang="ts">
	import { onMount } from 'svelte';
	import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
	import { Camera, RotateCw, X } from '@lucide/svelte';

	let { onResult, onClose }: { onResult: (value: string) => void; onClose: () => void } = $props();
	let video: HTMLVideoElement;
	let controls: IScannerControls | undefined;
	let starting = $state(true);
	let error = $state('');
	let disposed = false;

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
		starting = true;
		if (!navigator.mediaDevices?.getUserMedia) {
			error = '이 환경에서는 카메라 스캔을 지원하지 않습니다.';
			starting = false;
			return;
		}
		try {
			const reader = new BrowserQRCodeReader(undefined, {
				delayBetweenScanAttempts: 180,
				delayBetweenScanSuccess: 500
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
					scanner.stop();
					onResult(result.getText());
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

	onMount(() => {
		void start();
		return () => {
			disposed = true;
			controls?.stop();
		};
	});
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />
<div class="scanner-backdrop" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
	<div class="scanner-modal">
		<header>
			<div>
				<p>CAMERA IMPORT</p>
				<h2 id="scanner-title">QR 코드 스캔</h2>
			</div>
			<button onclick={onClose} aria-label="스캐너 닫기"><X size={22} /></button>
		</header>
		<div class="camera-preview">
			<video bind:this={video} muted playsinline></video>
			<div class="scan-frame"><i></i><i></i><i></i><i></i><span></span></div>
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
		</div>
		<p class="scanner-help">
			비트코인 주소, BIP21 QR, xpub/tpub 또는 output descriptor를 프레임 안에 맞춰 주세요.
		</p>
	</div>
</div>
