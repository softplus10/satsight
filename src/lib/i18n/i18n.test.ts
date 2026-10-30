import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { catalogs, DEFAULT_LOCALE, resolveLocale, intlLocale } from './catalogs';
import { en_US } from './locales/en_US';
import {
	formatDate,
	formatNumber,
	i18n,
	setLocale,
	t,
	localeFromUrl,
	localizedHref
} from './index';
import { translate, type MessageArgs, type MessageKey, type TranslationCatalog } from './translate';
import { addressLabel } from './address-label';
import type { WatchedAddress } from '$lib/domain/types';

afterEach(() => setLocale(DEFAULT_LOCALE));

describe('internationalization', () => {
	it('resolves regional codes and defaults to en_US for unsupported values', () => {
		expect(i18n.locale).toBe('en_US');
		expect(resolveLocale('EN_us')).toBe('en_US');
		expect(resolveLocale('en-CA')).toBe('en_CA');
		expect(resolveLocale('ko_KR')).toBe('ko_KR');
		for (const value of [undefined, null, '', 'en_GB', 'ko', 'unknown'])
			expect(resolveLocale(value)).toBe('en_US');
		expect(intlLocale('ko_KR')).toBe('ko-KR');
	});
	it('switches to complete Korean and Canadian English catalogs', () => {
		setLocale('ko_KR');
		expect(t('add_wallet')).toBe('지갑 추가');
		expect(t('wallet_count', { count: 1 })).toBe('지갑 1개');
		expect(t('wallet_count', { count: 2 })).toBe('지갑 2개');
		setLocale('en_CA');
		expect(t('add_wallet')).toBe('Add wallet');
		expect(t('wallet_count', { count: 1 })).toBe('1 wallet');
	});
	it('interpolates names without interpreting markup or nested placeholders', () => {
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
		// French uses "one" for zero; English fallback text must still use "other".
		expect(translate('fr_CA', {}, 'wallet_count', { count: 0 })).toBe('0 wallets');
		const french: TranslationCatalog = {
			wallet_count: { one: '{count} portefeuille', other: '{count} portefeuilles' }
		};
		expect(translate('fr_CA', french, 'wallet_count', { count: 0 })).toBe('0 portefeuille');
	});
	it.each(['en_US', 'en_CA', 'ko_KR'])('uses %s for date and number formatting', (locale) => {
		setLocale(locale);
		expect(formatNumber(1234.5)).toBe(new Intl.NumberFormat(intlLocale(locale)).format(1234.5));
		const date = Date.UTC(2026, 9, 30);
		const options: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeZone: 'UTC' };
		expect(formatDate(date, options)).toBe(
			new Intl.DateTimeFormat(intlLocale(locale), options).format(date)
		);
	});
});

describe('language query parameter', () => {
	it.each([
		['/?lang=ko_KR', 'ko_KR'],
		['/settings?lang=en_CA', 'en_CA'],
		['/wallets/new?lang=en_US', 'en_US'],
		['/?lang=en-ca', 'en_CA'],
		['/?lang=unsupported', 'en_US'],
		['/?lang=', 'en_US'],
		['/', 'en_US']
	])('resolves %s to %s', (path, expected) => {
		expect(localeFromUrl(new URL(path, 'https://satsight-demo.hskim.dev'))).toBe(expected);
	});
	it('preserves language, other query parameters, and fragments in internal navigation', () => {
		setLocale('ko_KR');
		expect(localizedHref('/wallets')).toBe('/wallets?lang=ko_KR');
		expect(localizedHref('/transactions?filter=sent#recent')).toBe(
			'/transactions?filter=sent&lang=ko_KR#recent'
		);
		expect(localizedHref('/?lang=en_CA')).toBe('/?lang=en_CA');
		expect(localizedHref(localizedHref('/settings'))).toBe('/settings?lang=ko_KR');
	});
	it('does not add language to external URLs or hash-only links', () => {
		for (const href of ['https://mempool.space', '//mempool.space', '#recent', 'bitcoin:bc1'])
			expect(localizedHref(href)).toBe(href);
	});
});

describe('translation catalogs', () => {
	const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
	for (const [locale, catalog] of Object.entries(catalogs)) {
		it(`${locale} is complete and preserves placeholders in every plural form`, () => {
			expect(Object.keys(catalog).sort()).toEqual(Object.keys(en_US).sort());
			for (const [key, message] of Object.entries(catalog)) {
				const source = en_US[key as MessageKey];
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
	it('localizes empty and legacy labels without changing stored records', () => {
		const legacy = { ...address, label: '거스름 #3' };
		expect(addressLabel(legacy)).toBe('Change #3');
		expect(legacy.label).toBe('거스름 #3');
		setLocale('ko_KR');
		expect(addressLabel(address)).toBe('거스름 #3');
		expect(addressLabel({ ...address, label: 'Change #3' })).toBe('거스름 #3');
	});
	it('preserves custom labels and handles single-address wallets', () => {
		setLocale('ko_KR');
		expect(addressLabel({ ...address, label: 'Savings' })).toBe('Savings');
		expect(addressLabel(address, true)).toBe('입금 주소');
	});
});
