import type { Wallet } from './types';
import { walletDescriptor } from './bitcoin';

/** Export only public configuration; device IDs, balances, and history stay local. */
export function walletExport(wallet: Wallet) {
	const common = {
		format: 'satsight-watch-wallet',
		version: 1,
		name: wallet.name,
		kind: wallet.kind,
		network: wallet.network
	};
	if (wallet.kind === 'address') return { ...common, address: wallet.source };
	const origin = wallet.keyOrigin;
	const path = origin?.path
		.map((index) => (index >= 0x80000000 ? `${index - 0x80000000}'` : String(index)))
		.join('/');
	const prefix = origin
		? `[${(origin.fingerprint >>> 0).toString(16).padStart(8, '0')}${path ? `/${path}` : ''}]`
		: '';
	const key = `${prefix}${wallet.source}`;
	return {
		...common,
		source: wallet.source,
		scriptType: wallet.scriptType,
		...(origin ? { keyOrigin: origin } : {}),
		// The receive descriptor is also accepted by the existing public-key QR importer.
		descriptor: walletDescriptor(key, wallet.scriptType, 0),
		changeDescriptor: walletDescriptor(key, wallet.scriptType, 1)
	};
}
