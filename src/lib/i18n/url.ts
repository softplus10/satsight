import { resolveLocale, type Locale } from './catalogs';
import { i18n } from './locale.svelte';

export function localeFromUrl(url: URL): Locale {
	return resolveLocale(url.searchParams.get('lang'));
}

/** Keep the selected language when following an internal link or calling goto(). */
export function localizedHref(href: string, locale: Locale = i18n.locale): string {
	if (!href.startsWith('/') || href.startsWith('//')) return href;
	const url = new URL(href, 'https://satsight.invalid');
	if (!url.searchParams.has('lang')) url.searchParams.set('lang', locale);
	return `${url.pathname}${url.search}${url.hash}`;
}
