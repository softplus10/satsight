export type BitcoinNetwork = 'mainnet' | 'testnet';
export type WalletKind = 'address' | 'xpub';
export type ScriptType = 'native-segwit' | 'nested-segwit' | 'taproot' | 'legacy';
export type TransactionDirection = 'received' | 'sent' | 'self';

export interface Wallet {
	id: string;
	name: string;
	kind: WalletKind;
	network: BitcoinNetwork;
	scriptType: ScriptType;
	source: string;
	color: string;
	balance: number;
	confirmedBalance: number;
	txCount: number;
	createdAt: string;
	updatedAt: string;
	lastSyncedAt?: string;
	syncError?: string;
}

export interface WatchedAddress {
	id: string;
	walletId: string;
	address: string;
	branch: 0 | 1;
	index: number;
	label: string;
	used: boolean;
	balance: number;
	txCount: number;
}

export interface WalletTransaction {
	id: string;
	walletId: string;
	txid: string;
	direction: TransactionDirection;
	value: number;
	fee?: number;
	status: 'confirmed' | 'pending';
	blockHeight?: number;
	blockTime?: number;
	firstSeen: number;
	note: string;
	addresses: string[];
}

export interface AppSettings {
	id: 'settings';
	currency: 'BTC' | 'sats';
	fiatCurrency: 'KRW' | 'USD' | 'JPY' | 'EUR';
	apiUrl: string;
	autoSync: boolean;
	gapLimit: number;
	theme: 'dark' | 'system';
}

export interface WalletDraft {
	name: string;
	kind: WalletKind;
	network: BitcoinNetwork;
	scriptType: ScriptType;
	source: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
	id: 'settings',
	currency: 'BTC',
	fiatCurrency: 'KRW',
	apiUrl: 'https://blockstream.info/api',
	autoSync: false,
	gapLimit: 20,
	theme: 'dark'
};
