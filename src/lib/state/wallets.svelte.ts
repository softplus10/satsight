import { browser } from '$app/environment';
import { deriveAddress } from '$lib/domain/bitcoin';
import type { AppSettings, Wallet, WalletDraft, WalletTransaction, WatchedAddress } from '$lib/domain/types';
import { DEFAULT_SETTINGS } from '$lib/domain/types';
import * as repository from '$lib/db/database';

const COLORS = ['#f5a623', '#5f8cff', '#9b7cff', '#43c59e', '#ef6f6c', '#57b8ff'];

class WalletState {
	wallets = $state<Wallet[]>([]);
	transactions = $state<WalletTransaction[]>([]);
	settings = $state<AppSettings>(DEFAULT_SETTINGS);
	ready = $state(false);
	loading = $state(false);

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
		const wallet: Wallet = {
			...draft,
			id: crypto.randomUUID(),
			source: draft.source.trim().replaceAll(/\s/g, ''),
			name: draft.name.trim(),
			color: COLORS[this.wallets.length % COLORS.length],
			balance: 0,
			confirmedBalance: 0,
			txCount: 0,
			createdAt: now,
			updatedAt: now
		};
		await repository.putWallet(wallet);
		const address: WatchedAddress = wallet.kind === 'address'
			? { id: `${wallet.id}:0:0`, walletId: wallet.id, address: wallet.source, branch: 0, index: 0, label: '입금 주소', used: false, balance: 0, txCount: 0 }
			: { id: `${wallet.id}:0:0`, walletId: wallet.id, address: deriveAddress(wallet.source, wallet.network, wallet.scriptType, 0, 0), branch: 0, index: 0, label: '주소 #1', used: false, balance: 0, txCount: 0 };
		await repository.putAddresses([address]);
		this.wallets = [wallet, ...this.wallets];
		return wallet;
	}

	async removeWallet(id: string) {
		await repository.deleteWallet(id);
		this.wallets = this.wallets.filter((wallet) => wallet.id !== id);
		this.transactions = this.transactions.filter((transaction) => transaction.walletId !== id);
	}

	async addresses(walletId: string) {
		return repository.listAddresses(walletId);
	}

	async saveSettings(settings: AppSettings) {
		await repository.putSettings(settings);
		this.settings = settings;
	}

	get totalBalance() {
		return this.wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
	}
}

export const walletState = new WalletState();
