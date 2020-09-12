import { Tx } from "./classes/Tx";
import { BlockTxsPairs, Tag } from "./types";
import { FORK_HEIGHT_1_8, BLOCK_TX_COUNT_LIMIT, BLOCK_TX_DATA_SIZE_LIMIT, WALLET_GEN_FEE, TX_DATA_SIZE_LIMIT, WALLET_NEVER_SPENT } from "./constants";
import { wallet_ownerToAddressString } from "./utils/wallet";
import Arweave from "arweave";
import { applyTxToWalletsObject } from "./wallets-utils";
import { txPerpetualStorage_calculateTxFee } from "./fees/tx-perpetual-storage";
import { WalletsObject } from "./classes/WalletsObject";
import { serialize, deserialize } from "v8";

/* This file is loosely based on `tx-replay-pool.erl` unless otherwiese stated */

/* based on ar_tx_replay_pool:verify_block_txs */
export const validateBlockTxs = async (
	txs: Tx[],
	diff: bigint,
	height: number,
	timestamp: bigint,
	prevBlockWallets: WalletsObject,
	blockTxsPairs: BlockTxsPairs
) => {

	if(height<FORK_HEIGHT_1_8) throw new Error("ar_tx_replay_pool__verify_block_txs invalid before FORK_HEIGHT_1_8")

	if(txs === []){ 
		return true
	}

	if(txs.length > BLOCK_TX_COUNT_LIMIT){
		console.log("BLOCK_TX_COUNT_LIMIT exceeded")
		return false
	}

	let updatedWallets: WalletsObject = deserialize(serialize(prevBlockWallets)) // clone as this function is for validation
	let verifiedTxs: string[] = [] //just txids of verified txs. (plays the role of erlang memPool here)
	let size = 0n

	for (let i = 0; i < txs.length; i++) {
		const tx = txs[i];

		if(tx.format === 1){
			size += tx.data_size
		}
		if(size > BLOCK_TX_DATA_SIZE_LIMIT){
			console.log("BLOCK_TX_DATA_SIZE_LIMIT exceeded")
			return false
		}

		// updatedWallets and verifiedTxs get updated directly
		let verifyTxResult = await validateBlockTx(tx, diff, height, timestamp, updatedWallets, blockTxsPairs, verifiedTxs)


		if(verifyTxResult === false){
			console.debug(`validateTx failed for txs[${i}]: ${tx.idString}`)
			console.debug('balance:'+updatedWallets[tx.idString].balance)
			console.debug('last_tx:'+updatedWallets[tx.idString].last_tx)
			return false
		}
	}

	return true
}

/* based on ar_tx_replay_pool:verify_tx */
const validateBlockTx = async (tx: Tx, diff: bigint, height: number, timestamp: bigint, wallets: WalletsObject, blockTxsPairs: BlockTxsPairs, verifiedTxs: string[]) => {
	if(height<FORK_HEIGHT_1_8) throw new Error("tx-replay_verify_txs unsupported before FORK_HEIGHT_1_8")

	let lastTxString = Arweave.utils.bufferTob64Url(tx.last_tx)
	
	// if( ! ar_tx:verify(TX, Diff, Height, FloatingWallets, Timestamp, VerifySignature) ) 
	// 	return false
	if( ! await verifyTx(tx, diff, height, timestamp, wallets) ){
		return false
	}
	
	//// last_tx_in_mempool
	// if( maps:is_key(TX#tx.last_tx, Mempool) )
	// 	return false
	if( verifiedTxs.includes(lastTxString) ){
		console.log('tx-replay-pool.verify_tx: '+lastTxString+' already in verifiedTxs')
		return false
	}

	//// last_tx
	// if( ar_tx:check_last_tx(FloatingWallets, TX) ){
	//	NewMempool = maps:put(TX#tx.id, no_tx, Mempool),
	//	NewFW = ar_node_utils:apply_tx(FloatingWallets, TX, Height),
	//	{valid, NewFW, NewMempool};
	// 	return true aka {newFW, newMempool}
	// }
	if( await ar_tx__check_last_tx(wallets, tx) ){
		//put tx in verifiedTxs
		verifiedTxs.push(tx.idString)
		//apply tx to modified wallets
		await applyTxToWalletsObject(wallets, tx)
		return true
	}

	//// anchor_check
	// if( ! lists:member(TX#tx.last_tx, WeaveState#state.bhl) ){
	// 	return false
	// }
	if( ! blockTxsPairs[lastTxString]){
		console.log("last_tx not in blockTxsPairs")
		return false
	}
	
	/// weave_check
	// if( weave_map_contains_tx(TX#tx.id, WeaveState#state.weave_map) ){
	// 	return false;  tx_already_in_weave
	// }
	if( weave_map_contains_tx(tx.idString, blockTxsPairs) ){
		console.log("tx_already_in_weave")
		return false
	}

	//// mempool_check
	// if( maps:is_key(TX#tx.id, Mempool) ){
	// 	return false ; tx_already_in_mempool
	// }
	if( verifiedTxs.includes(tx.idString)){
		console.log("tx already in verifiedTxs")
		return false
	}

	//// Survived checks, returns true
	// NewMempool = maps:put(TX#tx.id, no_tx, Mempool),
	// NewFW = ar_node_utils:apply_tx(FloatingWallets, TX, Height),
	// {valid, NewFW, NewMempool}
	// return true
	verifiedTxs.push(tx.idString)
	await applyTxToWalletsObject(wallets, tx)
	
	return true
}

const weave_map_contains_tx = (txid: string, blockTxsPairs: BlockTxsPairs) => {
	for (const blockId in blockTxsPairs) {
		if( blockTxsPairs[blockId].includes(txid) ){
			return true
		}
	}
	return false
}

const ar_tx__check_last_tx = async (wallets: WalletsObject, tx: Tx) => {
	let address = await wallet_ownerToAddressString(tx.owner)
	let last_tx = Arweave.utils.bufferTob64Url(tx.last_tx)

	if(wallets[address] && (wallets[address].last_tx === last_tx)){
		return true
	}

	return false
}

/* based on ar_tx:verify */
export const verifyTx = async (tx: Tx, diff: bigint, height: number, timestamp: bigint, wallets: WalletsObject) => {
	if(tx.quantity < 0n){
		console.log("quantity_negative")
		return false
	}
	if(tx.target === await wallet_ownerToAddressString(tx.owner)){
		console.log("same_owner_as_target")
		return false 
	}
	if( ! await tx.verify() ){
		console.log("invalid signature or txid. Hash mismatch")
		return false
	}

	if(tx.reward < calculate_min_tx_cost(tx.data_size, diff, height+1, wallets, tx.target, timestamp)){
		console.log("tx_too_cheap")
		return false 
	}

	/**
	 * These types of shape checks are probably out of scope here.
	 * They should be done on the incoming DTO / object creation, at source so to speak.
	 */
	if( ! tag_field_legal(tx) ){
		console.log("tag_field_illegally_specified")
		return false
	}

	let walletsClone = deserialize(serialize(wallets))
	await applyTxToWalletsObject(walletsClone, tx)
	if( ! await validate_overspend(tx, walletsClone) ){
		console.log("overspend in tx", tx.idString)
		return false
	}

	if(tx.format === 1) {
		if( !	tx_field_size_limit_v1(tx) ){
			console.log("tx_fields_too_large")
			return false
		}
	} else if(tx.format === 2){
		if( ! await tx_field_size_limit_v2(tx) ){
			console.log("tx_fields_too_large")
			return false
		}
		if(tx.data_size < 0n){
			console.log(" tx_data_size_negative")
			return false
		}
		if( (tx.data_size === 0n) !== ((await tx.getDataRoot()).length === 0) ){
			console.log("tx_data_size_data_root_mismatch")
			return false
		}
	} else{
		throw new Error(`tx format = ${tx.format} not supported`)
	}

	return true
}

const calculate_min_tx_cost = (size: bigint, diff: bigint, height: number, wallets: WalletsObject, target: string, timestamp: bigint,) => {
	if(height<FORK_HEIGHT_1_8) throw new Error("calculate_min_tx_cost unsupported before FORK_HEIGHT_1_8")

	let fee = 0n

	// check for first time wallet fee
	if(!wallets[target]){
		fee = WALLET_GEN_FEE
	}

	fee += txPerpetualStorage_calculateTxFee(size, diff, height, timestamp);

	return fee
}

const tag_field_legal = (tx: Tx) => {
	for (let i = 0; i < tx.tags.length; i++) {
		const tag = tx.tags[i];
		if(
			tag.name === undefined
			|| tag.value === undefined
			|| typeof tag.name !== 'string'
			|| typeof tag.value !== 'string'
		){
			return false
		}
	}
	return true
}

const validate_overspend = async (tx: Tx, wallets: WalletsObject) => {
	// validate_overspend(TX, Wallets) ->
	// 	From = ar_wallet:to_address(TX#tx.owner),
	// 	Addresses = case TX#tx.target of
	// 		<<>> ->
	// 			[From];
	// 		To ->
	// 			[From, To]
	// 	end,
	// 	lists:all(
	// 		fun(Addr) ->
	// 			case maps:get(Addr, Wallets, not_found) of
	// 				{0, Last} when byte_size(Last) == 0 ->
	// 					false;
	// 				{Quantity, _} when Quantity < 0 ->
	// 					false;
	// 				not_found ->
	// 					false;
	// 				_ ->
	// 					true
	// 			end
	// 		end,
	// 		Addresses
	// 	).

	let from = await wallet_ownerToAddressString(tx.owner)
	
	if(wallets[from]){
		let wallet = wallets[from]
		if(wallet.balance === 0n && wallet.last_tx === WALLET_NEVER_SPENT){
			return false
		}
		if(wallet.balance < 0n){
			return false
		}
	}else{ // if wallet[from] not found
		return false
	}
	
	if(tx.target !== ''){
		let to = tx.target
		
		if(wallets[to]){
			let wallet = wallets[to]
			if(wallet.balance === 0n && wallet.last_tx === WALLET_NEVER_SPENT){
				return false
			}
			if(wallet.balance < 0n){
				return false
			}
		}else{ // if wallet[to] not found
			return false
		}
	}

	return true
}

const tx_field_size_limit_v1 = (tx: Tx) => {
	return tx.id.length <= 32
		&& tx.last_tx.length <= 48
		&& tx.owner.length <= 512
		&& getTagsLength(tx.tags) <= 2048
		&& tx.target.length <= 43
		&& tx.quantity.toString().length <= 21
		&& tx.signature.length <= 512
		&& tx.reward.toString().length <= 21
		&& tx.data.length <= TX_DATA_SIZE_LIMIT
}
const tx_field_size_limit_v2 = async (tx: Tx) => {
	return tx.id.length <= 32
		&& tx.last_tx.length <= 48
		&& tx.owner.length <= 512
		&& getTagsLength(tx.tags) <= 2048
		&& tx.target.length <= 43
		&& tx.quantity.toString().length <= 21
		&& tx.signature.length <= 512
		&& tx.reward.toString().length <= 21
		&& tx.data_size.toString().length <= 21
		&& (await tx.getDataRoot()).length <= 32
}

const getTagsLength = (tags: Tag[]) => {
	let total = 0
	for (let i = 0; i < tags.length; i++) {
		const tag = tags[i];
		total += tag.name.length + tag.value.length
	}
	return total
}
