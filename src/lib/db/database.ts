import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { browser } from '$app/environment';
import {
	DEFAULT_SETTINGS,
	type AppSettings,
	type Wallet,
	type WalletTransaction,
	type WatchedAddress
} from '$lib/domain/types';

interface SatSightSchema extends DBSchema {
	wallets: { key: string; value: Wallet; indexes: { 'by-created': string } };
	addresses: { key: string; value: WatchedAddress; indexes: { 'by-wallet': string } };
	transactions: {
		key: string;
		value: WalletTransaction;
		indexes: { 'by-wallet': string; 'by-first-seen': number };
	};
	settings: { key: string; value: AppSettings };
}

let database: Promise<IDBPDatabase<SatSightSchema>> | undefined;

function db() {
	if (!browser) throw new Error('로컬 데이터베이스는 브라우저에서만 사용할 수 있습니다.');
	database ??= openDB<SatSightSchema>('satsight', 1, {
		upgrade(store) {
			const wallets = store.createObjectStore('wallets', { keyPath: 'id' });
			wallets.createIndex('by-created', 'createdAt');
			const addresses = store.createObjectStore('addresses', { keyPath: 'id' });
			addresses.createIndex('by-wallet', 'walletId');
			const transactions = store.createObjectStore('transactions', { keyPath: 'id' });
			transactions.createIndex('by-wallet', 'walletId');
			transactions.createIndex('by-first-seen', 'firstSeen');
			store.createObjectStore('settings', { keyPath: 'id' });
		}
	});
	return database;
}

export async function listWallets(): Promise<Wallet[]> {
	return (await (await db()).getAllFromIndex('wallets', 'by-created')).reverse();
}

export async function getWallet(id: string): Promise<Wallet | undefined> {
	return (await db()).get('wallets', id);
}

export async function putWallet(wallet: Wallet): Promise<void> {
	await (await db()).put('wallets', wallet);
}

export async function deleteWallet(id: string): Promise<void> {
	const store = await db();
	const transaction = store.transaction(['wallets', 'addresses', 'transactions'], 'readwrite');
	const addresses = await transaction.objectStore('addresses').index('by-wallet').getAllKeys(id);
	const transactions = await transaction
		.objectStore('transactions')
		.index('by-wallet')
		.getAllKeys(id);
	await Promise.all([
		transaction.objectStore('wallets').delete(id),
		...addresses.map((key) => transaction.objectStore('addresses').delete(key)),
		...transactions.map((key) => transaction.objectStore('transactions').delete(key))
	]);
	await transaction.done;
}

export async function listAddresses(walletId: string): Promise<WatchedAddress[]> {
	return (await (await db()).getAllFromIndex('addresses', 'by-wallet', walletId)).sort(
		(a, b) => a.branch - b.branch || a.index - b.index
	);
}

export async function putAddresses(addresses: WatchedAddress[]): Promise<void> {
	if (!addresses.length) return;
	const transaction = (await db()).transaction('addresses', 'readwrite');
	await Promise.all(addresses.map((address) => transaction.store.put(address)));
	await transaction.done;
}

export async function listTransactions(walletId?: string): Promise<WalletTransaction[]> {
	const store = await db();
	const values = walletId
		? await store.getAllFromIndex('transactions', 'by-wallet', walletId)
		: await store.getAll('transactions');
	return values.sort((a, b) => b.firstSeen - a.firstSeen);
}

export async function getTransaction(id: string): Promise<WalletTransaction | undefined> {
	return (await db()).get('transactions', id);
}

export async function putTransactions(transactions: WalletTransaction[]): Promise<void> {
	if (!transactions.length) return;
	const transaction = (await db()).transaction('transactions', 'readwrite');
	await Promise.all(transactions.map((item) => transaction.store.put(item)));
	await transaction.done;
}

export async function getSettings(): Promise<AppSettings> {
	const settings = await (await db()).get('settings', 'settings');
	if (settings) return settings;
	await putSettings(DEFAULT_SETTINGS);
	return DEFAULT_SETTINGS;
}

export async function putSettings(settings: AppSettings): Promise<void> {
	await (await db()).put('settings', settings);
}
