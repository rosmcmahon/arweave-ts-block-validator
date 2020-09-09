import { Tx } from "./Tx";
import { Wallet_List, BlockTxsPairs, Tag } from "./types";
import { FORK_HEIGHT_1_8, BLOCK_TX_COUNT_LIMIT, BLOCK_TX_DATA_SIZE_LIMIT, WALLET_GEN_FEE, TX_DATA_SIZE_LIMIT } from "./constants";
import { wallet_ownerToAddressString } from "./Wallet";
import Arweave from "arweave";
import { nodeUtils_ApplyTx } from "./NodeUtils";
import { txPerpetualStorage_calculateTxFee } from "./TxPerpetualStorage";



export const ar_tx_replay_pool__verify_block_txs = async (
	txs: Tx[],
	diff: bigint,
	height: number,
	timestamp: bigint,
	walletList: Wallet_List[],
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

	let updatedWalletList: Wallet_List[] = Object.assign([], walletList)
	// let updatedBlockTxxPairs: BlockTxsPairs = Object.assign({}, blockTxsPairs) // do not update, use mempool to storeupdates
	let verifiedTxs: string[] = [] //just txids of verified txs
	let size = 0n

	for (let i = 0; i < txs.length; i++) {
		const tx = txs[i];

		let verifyTxResult = await verify_tx(tx, diff, height, timestamp, updatedWalletList, blockTxsPairs, verifiedTxs)

		if(!verifyTxResult){
			return false
		}
		let { wallets: modifiedWallets, memPool: modifiedMemPool} = verifyTxResult
		updatedWalletList = modifiedWallets
		verifiedTxs = modifiedMemPool
	
		if(tx.format === 1){
			size += tx.data_size
		}
		if(size > BLOCK_TX_DATA_SIZE_LIMIT){
			console.log("BLOCK_TX_DATA_SIZE_LIMIT exceeded")
			return false
		}
	}

	return true
}

const verify_tx = async (tx: Tx, diff: bigint, height: number, timestamp: bigint, wallets: Wallet_List[], blockTxsPairs: BlockTxsPairs, verifiedTxs: string[]) => {
	if(height<FORK_HEIGHT_1_8) throw new Error("ar_tx_replay_verify_txs unsupported before FORK_HEIGHT_1_8")

	let lastTxString = Arweave.utils.bufferTob64Url(tx.last_tx)

	// if( ! ar_tx:verify(TX, Diff, Height, FloatingWallets, Timestamp, VerifySignature) ) 
	// 	return false
	if( !ar_tx__verify__combined1n2(tx, diff, height, timestamp, wallets) ){
		return false
	}
	
	//// last_tx_in_mempool
	// if( maps:is_key(TX#tx.last_tx, Mempool) )
	// 	return false
	if( verifiedTxs.includes(lastTxString) ){
		console.log('ar_tx_replay_pool.verify_tx returning false '+lastTxString+' in verifiedTxs')
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
		wallets = await nodeUtils_ApplyTx(wallets, tx, null)
		return {wallets, memPool: verifiedTxs}
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
		console.log("tx_already_in_mempool")
		return false
	}

	//// Survived checks, returns true
	// NewMempool = maps:put(TX#tx.id, no_tx, Mempool),
	// NewFW = ar_node_utils:apply_tx(FloatingWallets, TX, Height),
	// {valid, NewFW, NewMempool}
	// return true
	verifiedTxs.push(tx.idString)
	wallets = await nodeUtils_ApplyTx(wallets, tx, null)
	
	return {wallets, memPool: verifiedTxs}
}

const weave_map_contains_tx = (txid: string, blockTxsPairs: BlockTxsPairs) => {
	for (const blockId in blockTxsPairs) {
		if( blockTxsPairs[blockId].includes(txid) ){
			return true
		}
	}
	return false
}

const ar_tx__check_last_tx = async (wallets: Wallet_List[], tx: Tx) => {
	let address = await wallet_ownerToAddressString(tx.owner)
	let last_tx = Arweave.utils.bufferTob64Url(tx.last_tx)
	for (let i = 0; i < wallets.length; i++) {
		const entry = wallets[i];
		if(entry.address === address && entry.last_tx === last_tx){
			return true
		}
	}
	return false
}

//#region ar_tx__verifyAllChecks
export const ar_tx__verify__combined1n2 = async (tx: Tx, diff: bigint, height: number, timestamp: bigint, wallets: Wallet_List[]) => {
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
	 * They should be done on the incoming DTO / Tag object creation, at source so to speak.
	 */
	if( ! tag_field_legal(tx) ){
		console.log("tag_field_illegally_specified")
		return false
	}

	if( ! await validate_overspend(tx, await nodeUtils_ApplyTx(wallets, tx, null)) ){
		console.log("overspend in tx")
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

const calculate_min_tx_cost = (size: bigint, diff: bigint, height: number, wallets: Wallet_List[], target: string, timestamp: bigint,) => {
	if(height<FORK_HEIGHT_1_8) throw new Error("calculate_min_tx_cost unsupported before FORK_HEIGHT_1_8")

	// check for first time wallet fee
	let fee = WALLET_GEN_FEE
	for (let i = 0; i < wallets.length; i++) { //replace this for-loop during Wallet_List upgrade
		const entry = wallets[i];
		if(entry.address === target){
			fee = 0n
			break;
		}
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

const validate_overspend = async (tx: Tx, wallets: Wallet_List[]) => {
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

	/***** ALL OF THIS FUNCTION TO BE REWRITTEN ******/
	/***** ALL OF THIS FUNCTION TO BE REWRITTEN ******/
	/***** ALL OF THIS FUNCTION TO BE REWRITTEN ******/

	let from = await wallet_ownerToAddressString(tx.owner)
	
	for (let i = 0; i < wallets.length; i++) { // remove these loops during Wallet_List upgrade
		const entry = wallets[i];
		if( entry.address === from ){
			if(entry.balance === "0" && entry.last_tx.length === 0){
				return false
			}
			if( Number(entry.balance) < 0 ){
				return false
			}
			from = 'DONE'
		}
	}
	if(from !== 'DONE'){ //horrible
		return false
	}
	
	if(tx.target !== ''){
		let to = tx.target
		
		for (let i = 0; i < wallets.length; i++) { // remove these loops during Wallet_List upgrade
			const entry = wallets[i];
			if( entry.address === to ){
				if(entry.balance === "0" && entry.last_tx.length === 0){
					return false
				}
				if( Number(entry.balance) < 0 ){
					return false
				}
				to = 'DONE'
			}
		}
		if(to !== 'DONE'){ 
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
		&& tx.data.length <= TX_DATA_SIZE_LIMIT
		&& tx.signature.length <= 512
		&& tx.reward.toString().length <= 21
}
const tx_field_size_limit_v2 = async (tx: Tx) => {
	return tx.id.length <= 32
		&& tx.last_tx.length <= 48
		&& tx.owner.length <= 512
		&& getTagsLength(tx.tags) <= 2048
		&& tx.target.length <= 43
		&& tx.quantity.toString().length <= 21
		&& tx.data_size.toString().length <= 21
		&& tx.signature.length <= 512
		&& tx.reward.toString().length <= 21
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
