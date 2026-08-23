import { deriveAddress } from './bitcoin';
import type { Wallet, WatchedAddress } from './types';

export const MIN_GAP_LIMIT = 5;
export const MAX_GAP_LIMIT = 50;

export function normalizeGapLimit(value: number): number {
	if (!Number.isFinite(value)) return 20;
	return Math.min(MAX_GAP_LIMIT, Math.max(MIN_GAP_LIMIT, Math.floor(value)));
}

function emptyAddress(wallet: Wallet, branch: 0 | 1, index: number): WatchedAddress {
	return {
		id: `${wallet.id}:${branch}:${index}`,
		walletId: wallet.id,
		address:
			wallet.kind === 'address'
				? wallet.source
				: deriveAddress(wallet.source, wallet.network, wallet.scriptType, branch, index),
		branch,
		index,
		label:
			wallet.kind === 'address'
				? '입금 주소'
				: branch === 0
					? `주소 #${index + 1}`
					: `거스름 #${index + 1}`,
		used: false,
		balance: 0,
		confirmedBalance: 0,
		txCount: 0
	};
}

/** Ensures the locally visible pool without discarding synced metadata or deeper addresses. */
export function buildAddressPool(
	wallet: Wallet,
	gapLimit: number,
	knownAddresses: WatchedAddress[] = []
): WatchedAddress[] {
	const known = new Map(
		knownAddresses
			.filter((address) => address.walletId === wallet.id)
			.map((address) => [`${address.branch}:${address.index}`, address])
	);

	if (wallet.kind === 'address') {
		return [known.get('0:0') ?? emptyAddress(wallet, 0, 0)];
	}

	const size = normalizeGapLimit(gapLimit);
	for (const branch of [0, 1] as const) {
		for (let index = 0; index < size; index += 1) {
			const key = `${branch}:${index}`;
			if (!known.has(key)) known.set(key, emptyAddress(wallet, branch, index));
		}
	}
	return [...known.values()].sort((a, b) => a.branch - b.branch || a.index - b.index);
}
