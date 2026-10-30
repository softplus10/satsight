import { en } from './en';
import type { TranslationCatalog } from './translate';

// Register additional language catalogs here. Missing messages fall back to English.
export const catalogs: Record<string, TranslationCatalog> = { en };
export const DEFAULT_LOCALE = 'en';

export function resolveLocale(requested: string): string {
	const normalized = requested.toLowerCase().replaceAll('_', '-');
	return (
		Object.keys(catalogs).find((locale) => locale.toLowerCase() === normalized) ??
		Object.keys(catalogs).find((locale) => locale.toLowerCase() === normalized.split('-')[0]) ??
		DEFAULT_LOCALE
	);
}
