import { DEFAULT_LOCALE, resolveLocale } from './catalogs';

// Svelte tracks reads of this state inside t() and the formatting helpers.
// English remains the default regardless of the browser or device language.
export const i18n = $state({ locale: DEFAULT_LOCALE });

export function setLocale(requested: string): void {
	i18n.locale = resolveLocale(requested);
}
