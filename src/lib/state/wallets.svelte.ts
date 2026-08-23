import { browser } from '$app/environment';
import { buildAddressPool } from '$lib/domain/address-pool';
import { parseExtendedPublicKey } from '$lib/domain/bitcoin';
import type { AppSettings, Wallet, WalletDraft, WalletTransaction } from '$lib/domain/types';
import { DEFAULT_SETTINGS } from '$lib/domain/types';
import * as repository from '$lib/db/database';
import { syncWatchWallet } from '$lib/sync/esplora';

const COLORS = ['#f5a623', '#5f8cff', '#9b7cff', '#43c59e', '#ef6f6c', '#57b8ff'];

class WalletState {
	wallets = $state<Wallet[]>([]);
	transactions = $state<WalletTransaction[]>([]);
	settings = $state<AppSettings>(DEFAULT_SETTINGS);
	ready = $state(false);
	loading = $state(false);
	syncingIds = $state<string[]>([]);

	async initialize() {
		if (!browser || this.ready || this.loading) return;
		this.loading = true;
		try {
			[this.wallets, this.transactions, this.settings] = await Promise.all([
				repository.listWallets(),
				repository.listTransactions(),
				repository.getSettings()
			]);
			this.ready = true;
		} finally {
			this.loading = false;
		}
	}

	async addWallet(draft: WalletDraft): Promise<Wallet> {
		const now = new Date().toISOString();
		const extendedKey =
			draft.kind === 'xpub' ? parseExtendedPublicKey(draft.source, draft.network) : null;
		const wallet: Wallet = {
			...draft,
			id: crypto.randomUUID(),
			source: extendedKey?.source ?? draft.source.trim().replaceAll(/\s/g, ''),
			scriptType: extendedKey?.scriptType ?? draft.scriptType,
			name: draft.name.trim(),
			color: COLORS[this.wallets.length % COLORS.length],
			balance: 0,
			confirmedBalance: 0,
			txCount: 0,
			createdAt: now,
			updatedAt: now
		};
		await repository.putWallet(wallet);
		await repository.putAddresses(buildAddressPool(wallet, this.settings.gapLimit));
		this.wallets = [wallet, ...this.wallets];
		return wallet;
	}

	async removeWallet(id: string) {
		await repository.deleteWallet(id);
		this.wallets = this.wallets.filter((wallet) => wallet.id !== id);
		this.transactions = this.transactions.filter((transaction) => transaction.walletId !== id);
	}

	async addresses(walletId: string) {
		const wallet = this.wallets.find((item) => item.id === walletId);
		const known = await repository.listAddresses(walletId);
		if (!wallet) return known;
		const addresses = buildAddressPool(wallet, this.settings.gapLimit, known);
		if (addresses.length > known.length) await repository.putAddresses(addresses);
		return addresses;
	}

	async saveSettings(settings: AppSettings) {
		await repository.putSettings(settings);
		this.settings = settings;
	}

	async syncWallet(id: string) {
		const wallet = this.wallets.find((item) => item.id === id);
		if (!wallet || this.syncingIds.includes(id)) return;
		this.syncingIds = [...this.syncingIds, id];
		try {
			const addresses = await repository.listAddresses(id);
			const result = await syncWatchWallet(wallet, addresses, this.settings);
			await Promise.all([
				repository.putWallet(result.wallet),
				repository.putAddresses(result.addresses),
				repository.putTransactions(result.transactions)
			]);
			this.wallets = this.wallets.map((item) => (item.id === id ? result.wallet : item));
			this.transactions = await repository.listTransactions();
		} catch (cause) {
			const failed = {
				...wallet,
				syncError: cause instanceof Error ? cause.message : '동기화하지 못했습니다.'
			};
			await repository.putWallet(failed);
			this.wallets = this.wallets.map((item) => (item.id === id ? failed : item));
			throw cause;
		} finally {
			this.syncingIds = this.syncingIds.filter((item) => item !== id);
		}
	}

	async syncAll() {
		if (!navigator.onLine) return;
		for (const wallet of this.wallets) {
			try {
				await this.syncWallet(wallet.id);
			} catch {
				// Each wallet keeps its own error, so the remaining wallets can continue.
			}
		}
	}

	get totalBalance() {
		return this.wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
	}
}

export const walletState = new WalletState();
