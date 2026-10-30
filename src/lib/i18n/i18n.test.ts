import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { catalogs, resolveLocale } from './catalogs';
import { en } from './en';
import { formatDate, formatNumber, i18n, setLocale, t } from './index';
import { translate, type MessageArgs, type MessageKey, type TranslationCatalog } from './translate';
import { addressLabel } from './address-label';
import type { WatchedAddress } from '$lib/domain/types';

const originalCatalogs = { ...catalogs };

afterEach(() => {
	setLocale('en');
	for (const locale of Object.keys(catalogs)) delete catalogs[locale];
	Object.assign(catalogs, originalCatalogs);
});

describe('internationalization', () => {
	it('defaults to English and resolves registered base languages', () => {
		expect(i18n.locale).toBe('en');
		expect(resolveLocale('EN_us')).toBe('en');
		expect(resolveLocale('unknown')).toBe('en');
		catalogs.fr = { add_wallet: 'Ajouter un portefeuille' };
		setLocale('fr-CA');
		expect(i18n.locale).toBe('fr');
		expect(t('add_wallet')).toBe('Ajouter un portefeuille');
		expect(t('settings')).toBe('Settings');
	});

	it('interpolates names without interpreting them as markup or placeholders', () => {
		expect(t('remove_wallet_confirm', { name: '<b>{count}</b>' })).toBe(
			'Remove "<b>{count}</b>" from this device?'
		);
		expectTypeOf<MessageArgs<'remove_wallet_confirm'>>().toEqualTypeOf<
			[params: Record<'name', string | number>]
		>();
	});

	it('selects plural forms using the language of the actual message', () => {
		expect(t('wallet_count', { count: 0 })).toBe('0 wallets');
		expect(t('wallet_count', { count: 1 })).toBe('1 wallet');
		expect(t('transaction_count', { count: 2 })).toBe('2 transactions');
		// French uses "one" for zero, but an English fallback must still use "other".
		expect(translate('fr', {}, 'wallet_count', { count: 0 })).toBe('0 wallets');
		const french: TranslationCatalog = {
			wallet_count: { one: '{count} portefeuille', other: '{count} portefeuilles' }
		};
		expect(translate('fr', french, 'wallet_count', { count: 0 })).toBe('0 portefeuille');
	});

	it('formats numbers and dates through the active locale', () => {
		catalogs.fr = {};
		setLocale('fr');
		expect(formatNumber(1234.5)).toBe(new Intl.NumberFormat('fr').format(1234.5));
		const date = Date.UTC(2026, 9, 30);
		const options: Intl.DateTimeFormatOptions = { month: 'long', timeZone: 'UTC' };
		expect(formatDate(date, options)).toBe('octobre');
	});
});

describe('translation catalogs', () => {
	const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
	for (const [locale, catalog] of Object.entries(catalogs)) {
		it(`${locale} preserves source placeholders in every provided plural form`, () => {
			for (const [key, message] of Object.entries(catalog)) {
				const source = en[key as MessageKey];
				const expected = placeholders(typeof source === 'string' ? source : source.other);
				const variants = typeof message === 'string' ? [message] : Object.values(message);
				for (const variant of variants) {
					expect(variant.trim(), key).not.toBe('');
					expect(placeholders(variant), key).toEqual(expected);
				}
			}
		});
	}
});

describe('stored address labels', () => {
	const address: WatchedAddress = {
		id: 'wallet:1:2',
		walletId: 'wallet',
		address: 'unused',
		branch: 1,
		index: 2,
		label: '',
		used: false,
		balance: 0,
		confirmedBalance: 0,
		txCount: 0
	};

	it('localizes empty and legacy generated labels without changing stored records', () => {
		const legacy = { ...address, label: '\uAC70\uC2A4\uB984 #3' };
		expect(addressLabel(legacy)).toBe('Change #3');
		expect(legacy.label).toBe('\uAC70\uC2A4\uB984 #3');
		catalogs.fr = { change_address_number: 'Rendu n°{index}' };
		setLocale('fr');
		expect(addressLabel(address)).toBe('Rendu n°3');
		expect(addressLabel({ ...address, label: 'Change #3' })).toBe('Rendu n°3');
	});

	it('preserves custom labels and handles single-address wallets', () => {
		expect(addressLabel({ ...address, label: 'Savings' })).toBe('Savings');
		expect(addressLabel(address, true)).toBe('Receive address');
	});
});
