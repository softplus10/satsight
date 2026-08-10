<script lang="ts">
	import { goto } from '$app/navigation';
	import { KeyRound, MapPin, ShieldCheck } from '@lucide/svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { sourceError } from '$lib/domain/bitcoin';
	import type { BitcoinNetwork, ScriptType, WalletKind } from '$lib/domain/types';
	import { walletState } from '$lib/state/wallets.svelte';

	let name = $state('');
	let kind = $state<WalletKind>('xpub');
	let network = $state<BitcoinNetwork>('mainnet');
	let scriptType = $state<ScriptType>('native-segwit');
	let source = $state('');
	let error = $state('');
	let saving = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		if (!name.trim()) return (error = '지갑 이름을 입력하세요.');
		const validationError = sourceError(source, kind, network);
		if (validationError) return (error = validationError);
		saving = true;
		try {
			const wallet = await walletState.addWallet({ name, kind, network, scriptType, source });
			await goto(`/wallets/${wallet.id}`);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : '지갑을 저장하지 못했습니다.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>지갑 추가 · SatSight</title></svelte:head>
<main class="page narrow">
	<PageHeader title="Watch Wallet 추가" eyebrow="NEW WALLET" back="/wallets" />
	<form class="form-card" onsubmit={submit}>
		<fieldset class="source-picker">
			<legend>가져올 정보</legend>
			<button
				type="button"
				class:active={kind === 'xpub'}
				onclick={() => {
					kind = 'xpub';
					source = '';
					error = '';
				}}
				><KeyRound size={21} /><span
					><strong>확장 공개키</strong><small>여러 주소 자동 추적</small></span
				></button
			>
			<button
				type="button"
				class:active={kind === 'address'}
				onclick={() => {
					kind = 'address';
					source = '';
					error = '';
				}}
				><MapPin size={21} /><span><strong>단일 주소</strong><small>주소 하나만 추적</small></span
				></button
			>
		</fieldset>

		<label class="field"
			><span>지갑 이름</span><input
				bind:value={name}
				placeholder="예: 콜드월렛"
				maxlength="40"
				autocomplete="off"
			/></label
		>
		<div class="field">
			<span>네트워크</span>
			<div class="segmented">
				<button
					type="button"
					class:active={network === 'mainnet'}
					onclick={() => (network = 'mainnet')}>Mainnet</button
				><button
					type="button"
					class:active={network === 'testnet'}
					onclick={() => (network = 'testnet')}>Testnet</button
				>
			</div>
		</div>

		{#if kind === 'xpub'}
			<label class="field"
				><span>주소 형식</span><select bind:value={scriptType}
					><option value="native-segwit">Native SegWit (bc1q)</option><option value="nested-segwit"
						>Nested SegWit (3)</option
					><option value="taproot">Taproot (bc1p)</option><option value="legacy">Legacy (1)</option
					></select
				></label
			>
		{/if}

		<label class="field"
			><span>{kind === 'xpub' ? (network === 'mainnet' ? 'xpub' : 'tpub') : '비트코인 주소'}</span
			><textarea
				bind:value={source}
				rows="4"
				spellcheck="false"
				autocapitalize="off"
				placeholder={kind === 'xpub'
					? `${network === 'mainnet' ? 'xpub' : 'tpub'}...`
					: network === 'mainnet'
						? 'bc1q...'
						: 'tb1q...'}
			></textarea><small
				>{kind === 'xpub'
					? '계정 레벨 공개키를 사용하세요. 외부/내부 주소를 파생합니다.'
					: '이 주소의 잔액과 거래만 추적합니다.'}</small
			></label
		>

		<div class="security-note">
			<ShieldCheck size={20} />
			<div>
				<strong>개인키는 입력하지 마세요</strong>
				<p>SatSight는 xprv, 시드 문구, 개인키를 요구하지 않습니다.</p>
			</div>
		</div>
		{#if error}<p class="form-error" role="alert">{error}</p>{/if}
		<button class="button primary full" disabled={saving}
			>{saving ? '저장 중…' : '지갑 추가'}</button
		>
	</form>
</main>
