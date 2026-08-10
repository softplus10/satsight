import { HDKey, type Versions } from '@scure/bip32';
import { Address, NETWORK, TEST_NETWORK, p2pkh, p2sh, p2tr, p2wpkh } from '@scure/btc-signer';
import type { BitcoinNetwork, ScriptType } from './types';

export interface ParsedWalletQr {
	source: string;
	kind: 'address' | 'xpub';
	network: BitcoinNetwork;
	scriptType: ScriptType;
}

const MAINNET_VERSIONS: Versions = { public: 0x0488b21e, private: 0x0488ade4 };
const TESTNET_VERSIONS: Versions = { public: 0x043587cf, private: 0x04358394 };

function btcNetwork(network: BitcoinNetwork) {
	return network === 'mainnet' ? NETWORK : TEST_NETWORK;
}

function bip32Versions(network: BitcoinNetwork) {
	return network === 'mainnet' ? MAINNET_VERSIONS : TESTNET_VERSIONS;
}

export function cleanSource(source: string): string {
	return source.trim().replaceAll(/\s/g, '');
}

export function validateAddress(address: string, network: BitcoinNetwork): boolean {
	try {
		Address(btcNetwork(network)).decode(cleanSource(address));
		return true;
	} catch {
		return false;
	}
}

export function validateExtendedPublicKey(key: string, network: BitcoinNetwork): boolean {
	try {
		const node = HDKey.fromExtendedKey(cleanSource(key), bip32Versions(network));
		return node.privateKey === null && node.publicKey !== null;
	} catch {
		return false;
	}
}

export function deriveAddress(
	xpub: string,
	network: BitcoinNetwork,
	scriptType: ScriptType,
	branch: 0 | 1,
	index: number
): string {
	if (!Number.isSafeInteger(index) || index < 0)
		throw new Error('주소 인덱스가 올바르지 않습니다.');
	const root = HDKey.fromExtendedKey(cleanSource(xpub), bip32Versions(network));
	const publicKey = root.deriveChild(branch).deriveChild(index).publicKey;
	if (!publicKey) throw new Error('공개키를 파생할 수 없습니다.');
	const net = btcNetwork(network);

	switch (scriptType) {
		case 'legacy':
			return p2pkh(publicKey, net).address;
		case 'nested-segwit':
			return p2sh(p2wpkh(publicKey, net), net).address;
		case 'taproot':
			return p2tr(publicKey.slice(1), undefined, net).address;
		default:
			return p2wpkh(publicKey, net).address;
	}
}

export function sourceError(
	source: string,
	kind: 'address' | 'xpub',
	network: BitcoinNetwork
): string | null {
	if (!cleanSource(source))
		return kind === 'address' ? '비트코인 주소를 입력하세요.' : '확장 공개키를 입력하세요.';
	if (kind === 'address' && !validateAddress(source, network))
		return '선택한 네트워크와 주소가 맞지 않습니다.';
	if (kind === 'xpub' && !validateExtendedPublicKey(source, network))
		return '유효한 xpub 또는 tpub 공개키가 아닙니다.';
	return null;
}

export function shortAddress(value: string, head = 8, tail = 8): string {
	if (value.length <= head + tail + 3) return value;
	return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function formatSats(sats: number): string {
	return new Intl.NumberFormat('en-US').format(Math.round(sats));
}

export function formatBtc(sats: number, maximumFractionDigits = 8): string {
	return new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 0,
		maximumFractionDigits
	}).format(sats / 100_000_000);
}

export function walletDescriptor(source: string, type: ScriptType): string {
	const inner = `${cleanSource(source)}/0/*`;
	if (type === 'legacy') return `pkh(${inner})`;
	if (type === 'nested-segwit') return `sh(wpkh(${inner}))`;
	if (type === 'taproot') return `tr(${inner})`;
	return `wpkh(${inner})`;
}

export function parseWalletQr(raw: string): ParsedWalletQr | null {
	let value = raw.trim();
	if (!value) return null;

	try {
		const json = JSON.parse(value) as Record<string, unknown>;
		const nested = json.address ?? json.xpub ?? json.tpub ?? json.descriptor;
		if (typeof nested === 'string') value = nested.trim();
	} catch {
		// Plain-text QR values are the normal path.
	}

	if (value.toLowerCase().startsWith('bitcoin:')) {
		value = decodeURIComponent(value.slice(8).split('?')[0]);
	}

	let scriptType: ScriptType = 'native-segwit';
	const descriptor = value.match(
		/^(sh\(wpkh|wpkh|pkh|tr)\((?:\[[^\]]+\])?([xt]pub[1-9A-HJ-NP-Za-km-z]+)(?:\/[^)]*)?\)\)?(?:#[a-z0-9]+)?$/i
	);
	if (descriptor) {
		value = descriptor[2];
		const wrapper = descriptor[1].toLowerCase();
		scriptType =
			wrapper === 'pkh'
				? 'legacy'
				: wrapper === 'tr'
					? 'taproot'
					: wrapper === 'sh(wpkh'
						? 'nested-segwit'
						: 'native-segwit';
	}

	if (value.startsWith('xpub') && validateExtendedPublicKey(value, 'mainnet')) {
		return { source: value, kind: 'xpub', network: 'mainnet', scriptType };
	}
	if (value.startsWith('tpub') && validateExtendedPublicKey(value, 'testnet')) {
		return { source: value, kind: 'xpub', network: 'testnet', scriptType };
	}
	if (validateAddress(value, 'mainnet')) {
		return { source: value, kind: 'address', network: 'mainnet', scriptType };
	}
	if (validateAddress(value, 'testnet')) {
		return { source: value, kind: 'address', network: 'testnet', scriptType };
	}
	return null;
}
