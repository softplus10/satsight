<script lang="ts">
	import { t, i18n, LOCALE_NAMES } from '$lib/i18n';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { version as appVersion } from '../../../package.json';
	import { Check, Globe2 } from '@lucide/svelte';
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
	async function changeLanguage(event: Event) {
		const locale = (event.currentTarget as HTMLSelectElement).value;
		const url = new URL(page.url);
		url.searchParams.set('lang', locale);
		await goto(`${url.pathname}${url.search}${url.hash}`, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head><title>{t('page_title', { title: t('settings') })}</title></svelte:head>
<main class="page narrow">
	<PageHeader title={t('settings')} />
	<section class="settings-section">
		<h2>{t('display')}</h2>
		<div class="settings-panel">
			<label>
				<span><strong>{t('language')}</strong></span>
				<select value={i18n.locale} onchange={changeLanguage}>
					{#each Object.entries(LOCALE_NAMES) as [code, name] (code)}
						<option value={code}>{name}</option>
					{/each}
				</select>
			</label>
			<label
				><span><strong>{t('bitcoin_unit')}</strong><small>{t('default_balance_unit')}</small></span
				><select bind:value={form.currency}
					><option value="BTC">BTC</option><option value="sats">sats</option></select
				></label
			><label
				><span><strong>{t('fiat_currency')}</strong><small>{t('reference_currency')}</small></span
				><select bind:value={form.fiatCurrency}
					><option value="KRW">KRW</option><option value="USD">USD</option><option value="JPY"
						>JPY</option
					><option value="EUR">EUR</option></select
				></label
			>
		</div>
	</section>
	<section class="settings-section">
		<h2>{t('sync')}</h2>
		<div class="settings-panel">
			<label class="stacked"
				><span><Globe2 size={18} /><strong>{t('esplora_api_url')}</strong></span><input
					bind:value={form.apiUrl}
					spellcheck="false"
				/></label
			><label
				><span><strong>{t('sync_on_startup')}</strong><small>{t('auto_sync_help')}</small></span
				><input class="switch" type="checkbox" bind:checked={form.autoSync} /></label
			><label
				><span><strong>{t('gap_limit')}</strong><small>{t('gap_limit_help')}</small></span><input
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
		<h2>{t('privacy')}</h2>
		<p class="footnote">{t('privacy_notice')}</p>
	</section>
	<button class="button primary full" onclick={save}
		>{#if saved}<Check size={18} /> {t('saved')}{:else}{t('save_settings')}{/if}</button
	>
	<p class="version">SatSight {appVersion}</p>
</main>
