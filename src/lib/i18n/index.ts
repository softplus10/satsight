import { catalogs, intlLocale } from './catalogs';
import { i18n } from './locale.svelte';
import { translate, type MessageArgs, type MessageKey } from './translate';

export { i18n, setLocale } from './locale.svelte';
export { DEFAULT_LOCALE, LOCALE_NAMES, resolveLocale, intlLocale, type Locale } from './catalogs';
export { localeFromUrl, localizedHref } from './url';
export type { MessageKey, TranslationCatalog } from './translate';

export function t<K extends MessageKey>(key: K, ...args: MessageArgs<K>): string {
	return translate(i18n.locale, catalogs[i18n.locale] ?? {}, key, ...args);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
	return new Intl.NumberFormat(intlLocale(i18n.locale), options).format(value);
}

export function formatDate(value: number | Date, options?: Intl.DateTimeFormatOptions): string {
	return new Intl.DateTimeFormat(intlLocale(i18n.locale), options).format(value);
}
