import { en_US } from './locales/en_US';

export type MessageKey = keyof typeof en_US;
export type PluralMessage = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>;
export type TranslationCatalog = Partial<Record<MessageKey, string | PluralMessage>>;
type SourceMessage<K extends MessageKey> = (typeof en_US)[K] extends string
	? (typeof en_US)[K]
	: (typeof en_US)[K] extends { other: infer Text extends string }
		? Text
		: never;
type Placeholders<Text extends string> = Text extends `${string}{${infer Name}}${infer Rest}`
	? Name | Placeholders<Rest>
	: never;
export type MessageArgs<K extends MessageKey> = [Placeholders<SourceMessage<K>>] extends [never]
	? [params?: Record<string, string | number>]
	: [params: Record<Placeholders<SourceMessage<K>>, string | number>];

/** Resolve a complete message before interpolation, including locale-specific plurals. */
export function translate<K extends MessageKey>(
	locale: string,
	catalog: TranslationCatalog,
	key: K,
	...args: MessageArgs<K>
): string {
	const params = args[0] ?? {};
	const message: string | PluralMessage = catalog[key] ?? en_US[key];
	let text: string;
	if (typeof message === 'string') {
		text = message;
	} else {
		// Missing translations use English plural rules as well as English text.
		const language = catalog[key] ? locale.replaceAll('_', '-') : 'en-US';
		const category = new Intl.PluralRules(language).select(Number(params.count));
		text = message[category] ?? message.other;
	}
	return text.replace(/\{(\w+)\}/g, (_, name: string) => {
		if (!(name in params)) throw new Error(`Missing translation parameter: ${key}.${name}`);
		return String(params[name]);
	});
}
