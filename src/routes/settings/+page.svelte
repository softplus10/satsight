<script lang="ts">
	import { onMount } from 'svelte';
	import { Check, Database, Globe2, HardDrive, ShieldCheck } from '@lucide/svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { DEFAULT_SETTINGS, type AppSettings } from '$lib/domain/types';
	import { walletState } from '$lib/state/wallets.svelte';
	let form = $state<AppSettings>({ ...DEFAULT_SETTINGS });
	let saved = $state(false);
	onMount(async () => {
		await walletState.initialize();
		form = { ...walletState.settings };
	});
	async function save() {
		await walletState.saveSettings({ ...form });
		saved = true;
		setTimeout(() => (saved = false), 1500);
	}
</script>

<svelte:head><title>설정 · SatSight</title></svelte:head>
<main class="page narrow">
	<PageHeader title="설정" eyebrow="PREFERENCES" />
	<section class="settings-section">
		<h2>표시</h2>
		<div class="settings-panel">
			<label
				><span><strong>비트코인 단위</strong><small>잔액을 표시할 기본 단위</small></span><select
					bind:value={form.currency}
					><option value="BTC">BTC</option><option value="sats">sats</option></select
				></label
			><label
				><span><strong>법정화폐</strong><small>참고 가격에 사용할 통화</small></span><select
					bind:value={form.fiatCurrency}
					><option value="KRW">KRW</option><option value="USD">USD</option><option value="JPY"
						>JPY</option
					><option value="EUR">EUR</option></select
				></label
			>
		</div>
	</section>
	<section class="settings-section">
		<h2>동기화</h2>
		<div class="settings-panel">
			<label class="stacked"
				><span><Globe2 size={18} /><strong>Esplora API 주소</strong></span><input
					bind:value={form.apiUrl}
					spellcheck="false"
				/></label
			><label
				><span><strong>자동 동기화</strong><small>앱을 열 때 온라인이면 동기화</small></span><input
					class="switch"
					type="checkbox"
					bind:checked={form.autoSync}
				/></label
			><label
				><span><strong>Gap limit</strong><small>xpub에서 확인할 연속 미사용 주소</small></span
				><input
					class="number-input"
					type="number"
					min="5"
					max="50"
					bind:value={form.gapLimit}
				/></label
			>
		</div>
	</section>
	<section class="settings-section">
		<h2>개인정보와 저장소</h2>
		<div class="privacy-cards">
			<div>
				<HardDrive size={20} /><span
					><strong>온디바이스 저장</strong><small>IndexedDB에만 저장</small></span
				>
			</div>
			<div>
				<ShieldCheck size={20} /><span
					><strong>Watch Only</strong><small>개인키·서명 기능 없음</small></span
				>
			</div>
			<div>
				<Database size={20} /><span
					><strong>직접 선택한 서버</strong><small>동기화 시에만 연결</small></span
				>
			</div>
		</div>
	</section>
	<button class="button primary full" onclick={save}
		>{#if saved}<Check size={18} /> 저장됨{:else}설정 저장{/if}</button
	>
	<p class="version">SatSight 0.1.0 · Bitcoin only</p>
</main>
