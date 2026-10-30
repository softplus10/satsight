import type { ScriptType, WatchedAddress } from '$lib/domain/types';
import type { MessageKey } from './translate';
import { t } from './index';

const scriptTypeKeys: Record<ScriptType, MessageKey> = {
	legacy: 'script_legacy',
	'nested-segwit': 'script_nested_segwit',
	'native-segwit': 'script_native_segwit',
	taproot: 'script_taproot'
};

export function scriptTypeLabel(type: ScriptType): string {
	return t(scriptTypeKeys[type]);
}

/** Localize generated labels at render time; preserve names supplied by the user. */
export function addressLabel(address: WatchedAddress, singleAddress = false): string {
	// Older versions persisted generated labels in English or Korean. Recognize
	// only the label expected for this branch/index, without rewriting the record.
	const number = address.index + 1;
	const defaults = singleAddress
		? ['Receive address', '\uC785\uAE08 \uC8FC\uC18C']
		: address.branch === 0
			? [`Receive #${number}`, `\uC8FC\uC18C #${number}`]
			: [`Change #${number}`, `\uAC70\uC2A4\uB984 #${number}`];
	if (address.label && !defaults.includes(address.label)) return address.label;
	if (singleAddress) return t('receive_address');
	return address.branch === 0
		? t('receive_address_number', { index: number })
		: t('change_address_number', { index: number });
}
