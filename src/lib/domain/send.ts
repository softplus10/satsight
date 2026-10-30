import { t } from '$lib/i18n';
import { HDKey, type Versions } from '@scure/bip32';
import { hex } from '@scure/base';
import { Transaction, p2pkh, p2sh, p2tr, p2wpkh, selectUTXO } from '@scure/btc-signer';
import { bitcoinNetwork, deriveAddress, derivePublicKey, validateAddress } from './bitcoin';
import type { Wallet, WatchedAddress } from './types';

export interface SpendUtxo {
	txid: string;
	vout: number;
	value: number;
	address: WatchedAddress;
	nonWitnessUtxo?: string;
}

export interface PreparedSpend {
	psbt: Uint8Array;
	fee: number;
	feeRate: number;
	inputTotal: number;
	change: number;
	changeAddress?: string;
	inputCount: number;
	recipient: string;
	amount: number;
}

export interface FinalizedSpend {
	hex: string;
	txid: string;
	fee: number;
}

const MAINNET_VERSIONS: Versions = { public: 0x0488b21e, private: 0x0488ade4 };
const TESTNET_VERSIONS: Versions = { public: 0x043587cf, private: 0x04358394 };
const RBF_SEQUENCE = 0xfffffffd;

function payment(wallet: Wallet, publicKey: Uint8Array) {
	const network = bitcoinNetwork(wallet.network);
	if (wallet.scriptType === 'legacy') return p2pkh(publicKey, network);
	if (wallet.scriptType === 'nested-segwit') return p2sh(p2wpkh(publicKey, network), network);
	if (wallet.scriptType === 'taproot') return p2tr(publicKey.slice(1), undefined, network);
	return p2wpkh(publicKey, network);
}

function derivation(wallet: Wallet, address: Pick<WatchedAddress, 'branch' | 'index'>) {
	if (!wallet.keyOrigin) throw new Error(t('key_origin_required'));
	return {
		fingerprint: wallet.keyOrigin.fingerprint,
		// Signers need the full path from the master key, not just /branch/index.
		path: [...wallet.keyOrigin.path, address.branch, address.index]
	};
}

function signingFields(wallet: Wallet, address: Pick<WatchedAddress, 'branch' | 'index'>) {
	const publicKey = derivePublicKey(wallet.source, wallet.network, address.branch, address.index);
	const path = derivation(wallet, address);
	if (wallet.scriptType === 'taproot') {
		// BIP371 uses x-only internal keys; an empty hash list denotes key-path spending.
		const internalKey = publicKey.slice(1);
		return {
			tapInternalKey: internalKey,
			tapBip32Derivation: [[internalKey, { hashes: [], der: path }]] as [
				Uint8Array,
				{ hashes: Uint8Array[]; der: typeof path }
			][]
		};
	}
	return {
		bip32Derivation: [[publicKey, path]] as [Uint8Array, typeof path][],
		...(wallet.scriptType === 'nested-segwit'
			? { redeemScript: p2wpkh(publicKey, bitcoinNetwork(wallet.network)).script }
			: {})
	};
}

function nextChangeAddress(wallet: Wallet, addresses: WatchedAddress[]) {
	const change = addresses.filter((address) => address.branch === 1);
	const lastUsed = change.reduce(
		(last, address) => (address.used ? Math.max(last, address.index) : last),
		-1
	);
	const index = lastUsed + 1;
	return {
		branch: 1 as const,
		index,
		address: deriveAddress(wallet.source, wallet.network, wallet.scriptType, 1, index)
	};
}

function assertAccountOrigin(wallet: Wallet) {
	if (wallet.kind !== 'xpub') throw new Error(t('single_address_send_unsupported'));
	if (!wallet.keyOrigin) throw new Error(t('key_origin_reconnect_required'));
	const versions = wallet.network === 'mainnet' ? MAINNET_VERSIONS : TESTNET_VERSIONS;
	const account = HDKey.fromExtendedKey(wallet.source, versions);
	if (account.depth !== wallet.keyOrigin.path.length) {
		throw new Error(t('key_origin_depth_mismatch'));
	}
}

export function createSpendPsbt(
	wallet: Wallet,
	addresses: WatchedAddress[],
	utxos: SpendUtxo[],
	recipient: string,
	amount: number,
	feeRate: number
): PreparedSpend {
	assertAccountOrigin(wallet);
	if (!validateAddress(recipient, wallet.network)) throw new Error(t('recipient_network_mismatch'));
	if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error(t('invalid_send_amount'));
	if (!Number.isFinite(feeRate) || feeRate < 1 || feeRate > 10_000) {
		throw new Error(t('invalid_fee_rate'));
	}

	const candidates = utxos.map((utxo) => {
		if (!Number.isSafeInteger(utxo.value) || utxo.value <= 0)
			throw new Error(t('invalid_utxo_amount'));
		const publicKey = derivePublicKey(
			wallet.source,
			wallet.network,
			utxo.address.branch,
			utxo.address.index
		);
		const expected = payment(wallet, publicKey);
		// Re-derive ownership locally instead of trusting an address from the API.
		if (expected.address !== utxo.address.address) {
			throw new Error(t('utxo_derivation_mismatch'));
		}
		const fields = signingFields(wallet, utxo.address);
		const common = {
			txid: utxo.txid,
			index: utxo.vout,
			sequence: RBF_SEQUENCE,
			...fields
		};
		if (wallet.scriptType === 'legacy') {
			// Legacy inputs need the entire previous transaction in the PSBT.
			if (!utxo.nonWitnessUtxo) throw new Error(t('legacy_previous_transaction_required'));
			return { ...common, nonWitnessUtxo: hex.decode(utxo.nonWitnessUtxo) };
		}
		return {
			...common,
			witnessUtxo: { script: expected.script, amount: BigInt(utxo.value) }
		};
	});

	const change = nextChangeAddress(wallet, addresses);
	const selected = selectUTXO(
		candidates,
		[{ address: recipient, amount: BigInt(amount) }],
		'default',
		{
			feePerByte: BigInt(Math.ceil(feeRate)),
			changeAddress: change.address,
			network: bitcoinNetwork(wallet.network),
			bip69: false,
			createTx: true
		}
	);
	if (!selected?.tx) throw new Error(t('insufficient_funds'));

	let changeAmount = 0;
	if (selected.change) {
		// With BIP69 sorting disabled, the selector appends change last. Its origin
		// metadata lets the external signer identify it as belonging to this wallet.
		const outputIndex = selected.outputs.length - 1;
		selected.tx.updateOutput(outputIndex, signingFields(wallet, change));
		changeAmount = Number(selected.outputs[outputIndex].amount);
	}
	const inputTotal = selected.inputs.reduce((sum, input) => {
		const txid = typeof input.txid === 'string' ? input.txid : hex.encode(input.txid!);
		const source = utxos.find((utxo) => utxo.txid === txid && utxo.vout === input.index);
		if (!source) throw new Error(t('selected_utxo_not_found'));
		return sum + source.value;
	}, 0);

	return {
		psbt: selected.tx.toPSBT(0),
		fee: Number(selected.fee),
		feeRate: Math.ceil(feeRate),
		inputTotal,
		change: changeAmount,
		changeAddress: selected.change ? change.address : undefined,
		inputCount: selected.inputs.length,
		recipient,
		amount
	};
}

export function finalizeSignedPsbt(
	originalPsbt: Uint8Array,
	signedPsbt: Uint8Array
): FinalizedSpend {
	const original = Transaction.fromPSBT(originalPsbt);
	const signed = Transaction.fromPSBT(signedPsbt);
	// Bind the returned signatures to the exact transaction the user reviewed.
	// Compare before merging so an imported PSBT cannot replace inputs or outputs.
	if (hex.encode(original.unsignedTx) !== hex.encode(signed.unsignedTx)) {
		throw new Error(t('signed_psbt_changed'));
	}
	try {
		original.combine(signed);
		original.finalize();
	} catch {
		throw new Error(t('psbt_finalization_failed'));
	}
	return { hex: original.hex, txid: original.id, fee: Number(original.fee) };
}
