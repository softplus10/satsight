import { en_US } from './locales/en_US';
import { en_CA } from './locales/en_CA';
import { ko_KR } from './locales/ko_KR';
import type { TranslationCatalog } from './translate';

// Register additional language catalogs here. Missing messages fall back to English.
export const catalogs = { en_US, en_CA, ko_KR } satisfies Record<string, TranslationCatalog>;
export type Locale = keyof typeof catalogs;
export const DEFAULT_LOCALE: Locale = 'en_US';
export const LOCALE_NAMES: Record<Locale, string> = {
	en_US: 'English (United States)',
	en_CA: 'English (Canada)',
	ko_KR: '한국어'
};

export function resolveLocale(requested?: string | null): Locale {
	const normalized = requested?.toLowerCase().replaceAll('-', '_');
	return (
		(Object.keys(catalogs) as Locale[]).find((locale) => locale.toLowerCase() === normalized) ??
		DEFAULT_LOCALE
	);
}

/** Intl and HTML use BCP 47 tags, while application URLs use language_REGION. */
export function intlLocale(locale: string): string {
	return locale.replaceAll('_', '-');
}
