import { en_US } from './en_US';
import type { TranslationCatalog } from '../translate';

// Shared English copy stays in en_US. Add Canadian wording overrides here;
// en_CA still selects Canadian date, number, and plural formatting at runtime.
export const en_CA = { ...en_US } satisfies Required<TranslationCatalog>;
