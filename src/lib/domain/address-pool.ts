import { deriveAddress } from './bitcoin';
import { t } from '$lib/i18n';
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
		// Generated labels are localized by the view, not persisted in a language.
		label: '',
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

/** Derive one bounded page; pagination does not change the synchronization gap limit. */
export function buildAddressPage(
	wallet: Wallet,
	branch: 0 | 1,
	start: number,
	count = 20,
	knownAddresses: WatchedAddress[] = []
): WatchedAddress[] {
	const end = 0x80000000; // Public child derivation stops before hardened indexes.
	if (
		!Number.isSafeInteger(start) ||
		start < 0 ||
		start > end ||
		!Number.isSafeInteger(count) ||
		count < 1 ||
		count > 50
	) {
		throw new Error(t('invalid_address_page'));
	}
	if (wallet.kind === 'address' && (branch !== 0 || start !== 0)) return [];
	const known = new Map(
		knownAddresses
			.filter((item) => item.walletId === wallet.id && item.branch === branch)
			.map((item) => [item.index, item])
	);
	const size = wallet.kind === 'address' ? 1 : Math.min(count, end - start);
	return Array.from({ length: size }, (_, offset) => {
		const index = start + offset;
		return known.get(index) ?? emptyAddress(wallet, branch, index);
	});
}
