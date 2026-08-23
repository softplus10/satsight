import { HDKey, type Versions } from '@scure/bip32';
import { Address, NETWORK, TEST_NETWORK, p2pkh, p2sh, p2tr, p2wpkh } from '@scure/btc-signer';
import type { BitcoinNetwork, ScriptType } from './types';

export interface ParsedWalletQr {
	source: string;
	kind: 'address' | 'xpub';
	network: BitcoinNetwork;
	scriptType: ScriptType;
}

export interface ParsedExtendedPublicKey {
	source: string;
	network: BitcoinNetwork;
	scriptType?: ScriptType;
}

const MAINNET_VERSIONS: Versions = { public: 0x0488b21e, private: 0x0488ade4 };
const TESTNET_VERSIONS: Versions = { public: 0x043587cf, private: 0x04358394 };
const KEY_ORIGIN = /^\[([0-9a-fA-F]{8})((?:\/\d+(?:['hH])?)*)\](.+)$/;
const EXTENDED_PUBLIC_KEY_VERSIONS: Record<
	string,
	{ versions: Versions; network: BitcoinNetwork; scriptType?: ScriptType }
> = {
	xpub: { versions: MAINNET_VERSIONS, network: 'mainnet' },
	ypub: {
		versions: { public: 0x049d7cb2, private: MAINNET_VERSIONS.private },
		network: 'mainnet',
		scriptType: 'nested-segwit'
	},
	zpub: {
		versions: { public: 0x04b24746, private: MAINNET_VERSIONS.private },
		network: 'mainnet',
		scriptType: 'native-segwit'
	},
	tpub: { versions: TESTNET_VERSIONS, network: 'testnet' },
	upub: {
		versions: { public: 0x044a5262, private: TESTNET_VERSIONS.private },
		network: 'testnet',
		scriptType: 'nested-segwit'
	},
	vpub: {
		versions: { public: 0x045f1cf6, private: TESTNET_VERSIONS.private },
		network: 'testnet',
		scriptType: 'native-segwit'
	}
};

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

export function parseExtendedPublicKey(
	key: string,
	network?: BitcoinNetwork
): ParsedExtendedPublicKey | null {
	let value = cleanSource(key);
	let originScriptType: ScriptType | undefined;
	let originNetwork: BitcoinNetwork | undefined;
	const origin = value.match(KEY_ORIGIN);
	if (origin) {
		const path = origin[2]
			.slice(1)
			.split('/')
			.filter(Boolean)
			.map((component) => Number(component.replace(/['hH]$/, '')));
		if (path.some((component) => !Number.isSafeInteger(component) || component >= 0x80000000)) {
			return null;
		}
		originScriptType =
			path[0] === 44
				? 'legacy'
				: path[0] === 49
					? 'nested-segwit'
					: path[0] === 84
						? 'native-segwit'
						: path[0] === 86
							? 'taproot'
							: undefined;
		originNetwork = path[1] === 0 ? 'mainnet' : path[1] === 1 ? 'testnet' : undefined;
		value = origin[3];
	}
	const format = EXTENDED_PUBLIC_KEY_VERSIONS[value.slice(0, 4)];
	if (
		!format ||
		(network && format.network !== network) ||
		(originNetwork && originNetwork !== format.network) ||
		(originScriptType && format.scriptType && originScriptType !== format.scriptType)
	) {
		return null;
	}
	try {
		const node = HDKey.fromExtendedKey(value, format.versions);
		if (node.privateKey !== null || !node.publicKey || !node.chainCode) return null;
		const normalized = new HDKey({
			versions: bip32Versions(format.network),
			depth: node.depth,
			index: node.index,
			parentFingerprint: node.parentFingerprint,
			chainCode: node.chainCode,
			publicKey: node.publicKey
		}).publicExtendedKey;
		return {
			source: normalized,
			network: format.network,
			scriptType: originScriptType ?? format.scriptType
		};
	} catch {
		return null;
	}
}

export function validateExtendedPublicKey(key: string, network: BitcoinNetwork): boolean {
	return parseExtendedPublicKey(key, network) !== null;
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
	const parsed = parseExtendedPublicKey(xpub, network);
	if (!parsed) throw new Error('확장 공개키가 올바르지 않습니다.');
	const root = HDKey.fromExtendedKey(parsed.source, bip32Versions(network));
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
		return '유효한 xpub/ypub/zpub 또는 tpub/upub/vpub 공개키가 아닙니다.';
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
		const nested =
			json.address ??
			json.xpub ??
			json.ypub ??
			json.zpub ??
			json.tpub ??
			json.upub ??
			json.vpub ??
			json.descriptor;
		if (typeof nested === 'string') value = nested.trim();
	} catch {
		// Plain-text QR values are the normal path.
	}

	if (value.toLowerCase().startsWith('bitcoin:')) {
		value = decodeURIComponent(value.slice(8).split('?')[0]);
	}

	let descriptorScriptType: ScriptType | undefined;
	const descriptor = value.match(
		/^(sh\(wpkh|wpkh|pkh|tr)\((?:\[[^\]]+\])?([A-Za-z]pub[1-9A-HJ-NP-Za-km-z]+)(?:\/[^)]*)?\)\)?(?:#[a-z0-9]+)?$/
	);
	if (descriptor) {
		value = descriptor[2];
		const wrapper = descriptor[1];
		descriptorScriptType =
			wrapper === 'pkh'
				? 'legacy'
				: wrapper === 'tr'
					? 'taproot'
					: wrapper === 'sh(wpkh'
						? 'nested-segwit'
						: 'native-segwit';
	}

	const extendedKey = parseExtendedPublicKey(value);
	if (extendedKey) {
		return {
			source: extendedKey.source,
			kind: 'xpub',
			network: extendedKey.network,
			scriptType: descriptorScriptType ?? extendedKey.scriptType ?? 'native-segwit'
		};
	}
	if (validateAddress(value, 'mainnet')) {
		return {
			source: value,
			kind: 'address',
			network: 'mainnet',
			scriptType: descriptorScriptType ?? 'native-segwit'
		};
	}
	if (validateAddress(value, 'testnet')) {
		return {
			source: value,
			kind: 'address',
			network: 'testnet',
			scriptType: descriptorScriptType ?? 'native-segwit'
		};
	}
	return null;
}
