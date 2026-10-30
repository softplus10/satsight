import { Address } from '@scure/btc-signer';
import { bitcoinNetwork } from '$lib/domain/bitcoin';
import type { Wallet } from '$lib/domain/types';
import { scriptTypeLabel } from './address-label';
import { t } from './index';

export function walletSignatureLabel(wallet: Wallet): string {
	// Account imports currently support single-key wallets only. A standalone
	// address cannot reveal its signing policy, including multisig thresholds.
	return wallet.kind === 'xpub' ? t('single_sig') : t('unknown');
}

export function walletScriptLabel(wallet: Wallet): string {
	if (wallet.kind === 'xpub') return scriptTypeLabel(wallet.scriptType);
	try {
		const output = Address(bitcoinNetwork(wallet.network)).decode(wallet.source);
		switch (output.type) {
			case 'pkh':
				return scriptTypeLabel('legacy');
			case 'wpkh':
				return scriptTypeLabel('native-segwit');
			case 'tr':
				return scriptTypeLabel('taproot');
			// P2SH alone does not prove nested SegWit or a particular signing policy.
			case 'sh':
				return 'P2SH';
			case 'wsh':
				return 'P2WSH';
			default:
				return t('unknown');
		}
	} catch {
		return t('unknown');
	}
}
