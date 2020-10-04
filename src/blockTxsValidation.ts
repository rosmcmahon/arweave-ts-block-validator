import { Tx } from "./classes/Tx";
import { BlockTxsPairs, ReturnCode, Tag } from "./types";
import { FORK_HEIGHT_1_8, BLOCK_TX_COUNT_LIMIT, BLOCK_TX_DATA_SIZE_LIMIT, WALLET_GEN_FEE, TX_DATA_SIZE_LIMIT, WALLET_NEVER_SPENT } from "./constants";
import { wallet_ownerToAddressString } from "./utils/wallet";
import Arweave from "arweave";
import { applyTxToWalletsObject } from "./wallets-utils";
import { txPerpetualStorage_calculateTxFee } from "./fees/tx-perpetual-storage";
import { WalletsObject } from "./classes/WalletsObject";
import { serialize, deserialize } from "v8";

/* This file is loosely based on `tx-replay-pool.erl` unless otherwiese stated */

const RETURNCODE_TRUE: ReturnCode = {value: true, message: "Valid block txs"}

/* based on ar_tx_replay_pool:verify_block_txs */
export const validateBlockTxs = async (
	txs: Tx[],
	diff: bigint,
	height: number,
	timestamp: bigint,
	prevBlockWallets: WalletsObject,
	blockTxsPairs: BlockTxsPairs
): Promise<ReturnCode> => {

	if(height<FORK_HEIGHT_1_8) throw new Error("ar_tx_replay_pool__verify_block_txs invalid before FORK_HEIGHT_1_8")

	if(txs === []){ 
		return RETURNCODE_TRUE
	}

	if(txs.length > BLOCK_TX_COUNT_LIMIT){
		return {value: false, message: "BLOCK_TX_COUNT_LIMIT exceeded"}
	}

	let updatedWallets: WalletsObject = deserialize(serialize(prevBlockWallets)) // clone as this function is for validation
	let verifiedTxs: string[] = [] //just txids of verified txs. (plays the role of erlang memPool here)
	let size = 0n

	for (let i = 0; i < txs.length; i++) {
		const tx = txs[i]

		if(tx.format === 1){
			size += tx.data_size
		}
		if(size > BLOCK_TX_DATA_SIZE_LIMIT){
			return {value: false, message: "BLOCK_TX_DATA_SIZE_LIMIT exceeded"}
		}

		// updatedWallets and verifiedTxs get updated directly
		let validateTxResult = await validateBlockTx(tx, diff, height, timestamp, updatedWallets, blockTxsPairs, verifiedTxs)


		if(validateTxResult.value === false){
			return validateTxResult
		}
	}

	return RETURNCODE_TRUE
}

/* based on ar_tx_replay_pool:verify_tx */
const validateBlockTx = async (
	tx: Tx, diff: bigint, height: number, timestamp: bigint, wallets: WalletsObject, blockTxsPairs: BlockTxsPairs, verifiedTxs: string[]
): Promise<ReturnCode> => {

	let lastTxString = Arweave.utils.bufferTob64Url(tx.last_tx)	

	let verifyTxResult = await verifyTx(tx, diff, height, timestamp, wallets)
	if( verifyTxResult.value === false ){
		return verifyTxResult
	}
	
	// Anchor check. last_tx in verified txs.
	if( verifiedTxs.includes(lastTxString) ){
		return {value: false, message: 'last_tx in verified txs pool'}
	}

	// Anchor check. last_tx is same as last_tx in wallets
	if( await verifyLastTxForWallets(wallets, tx) ){
		verifiedTxs.push(tx.idString)
		await applyTxToWalletsObject(wallets, tx)
		return RETURNCODE_TRUE
	}

	// Anchor check. last_tx is a blockId or txid in the blockTxsPairs object
	if( ! blockTxsPairs[lastTxString] ){
		return {value: false, message: "last_tx anchor not in blockTxsPairs"}
	}
	
	/// "weave check". If tx already in last 50 blocks then reject
	if( blockTxsPairs_containsTx(tx.idString, blockTxsPairs) ){
		return {value: false, message: "tx already in blockTxsPairs"}
	}

	// "mempool_check" 
	if( verifiedTxs.includes(tx.idString)){
		return {value: false, message: "tx already in verifiedTxs"}
	}

	// Survived checks, returns true
	verifiedTxs.push(tx.idString)
	await applyTxToWalletsObject(wallets, tx)
	
	return RETURNCODE_TRUE
}

const blockTxsPairs_containsTx = (txid: string, blockTxsPairs: BlockTxsPairs) => {
	for (const blockId in blockTxsPairs) {
		if( blockTxsPairs[blockId].includes(txid) ){
			return true
		}
	}
	return false
}

const verifyLastTxForWallets = async (wallets: WalletsObject, tx: Tx) => {
	let address = await wallet_ownerToAddressString(tx.owner)
	let last_tx = Arweave.utils.bufferTob64Url(tx.last_tx)

	if(wallets[address] && (wallets[address].last_tx === last_tx)){
		return true
	}

	return false
}

/* based on ar_tx:verify */
export const verifyTx = async (tx: Tx, diff: bigint, height: number, timestamp: bigint, wallets: WalletsObject): Promise<ReturnCode> => {

	if(tx.quantity < 0n){
		return {value: false, message: "tx quantity negative"}
	}

	if(tx.target === await wallet_ownerToAddressString(tx.owner)){
		return {value: false, message: "tx owner same as tx target"} 
	}

	if( ! await tx.verify() ){
		console.log('invalid sig txid '+tx.idString)
		return {value: false, message: "invalid signature or txid. Hash mismatch"} 
	}

let thisCalcdMinTxCost = calculateMinTxCost(tx.data_size, diff, height + 1, wallets, tx.target, timestamp)
console.log( 
	`tx.id ${tx.idString}
	calcedCost ${thisCalcdMinTxCost} / tx.reward ${tx.reward} = ${ (Number(thisCalcdMinTxCost)/Number(tx.reward)) }
	`
)
	if(tx.reward < calculateMinTxCost(tx.data_size, diff, height + 1, wallets, tx.target, timestamp)){
		return {value: false, message: "tx reward too cheap"}  
	}

	/**
	 * These types of shape checks are probably out of scope here.
	 * They should be done on the incoming DTO / object creation, at source so to speak.
	 */
	if( ! tag_field_legal(tx) ){
		return {value: false, message: "tx tag_field_illegally_specified"} 
	}

	// validate not overspend
	let walletsClone = deserialize(serialize(wallets))
	await applyTxToWalletsObject(walletsClone, tx)
	if( ! await validateOverspend(tx, walletsClone) ){
		return {value: false, message: "overspend in tx"} 
	}

	if(tx.format === 1) {
		if( !	tx_field_size_limit_v1(tx) ){
			return {value: false, message: "tx_fields_too_large"}
		}
	} else if(tx.format === 2){
		if( ! await tx_field_size_limit_v2(tx) ){
			return {value: false, message: "tx_fields_too_large"}
		}
		if(tx.data_size < 0n){
			return {value: false, message: "tx_data_size_negative"}
		}
		if( (tx.data_size === 0n) !== ((await tx.getDataRoot()).length === 0) ){
			return {value: false, message: "tx_data_size_data_root_mismatch"}
		}
	} else{
		throw new Error(`tx format = ${tx.format} not supported`)
	}

	return RETURNCODE_TRUE
}

const calculateMinTxCost = (size: bigint, diff: bigint, height: number, wallets: WalletsObject, target: string, timestamp: bigint,) => {
	if(height<FORK_HEIGHT_1_8) throw new Error("calculate_min_tx_cost unsupported before FORK_HEIGHT_1_8")

	let fee = 0n

	// check for first time wallet fee
	if(target.length > 0 && !wallets[target]){
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

const validateOverspend = async (tx: Tx, wallets: WalletsObject) => {

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
