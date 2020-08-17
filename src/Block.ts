import { Poa } from './types/Poa'
import { BlockDTO } from "./types/BlockDTO"
import { BigNumber } from 'bignumber.js'
import Arweave from 'arweave'

/* Actual binary data for a Block. Usually translated from a Block JSON Data Transfer Object */
export class Block {
	/* member variables, for more details see BlockJson.ts */
	nonce: string // The nonce used to satisfy the PoW problem when mined.
	previous_block: Uint8Array // indep_hash of the previous block in the weave.
	timestamp: number // POSIX time of block discovery.
	last_retarget: number // POSIX time of the last difficulty retarget.
	diff: BigNumber  // The PoW difficulty - the number a PoW hash must be greater than.
	height:number // How many blocks have passed since the genesis block.
	hash: Uint8Array // PoW hash of the block must satisfy the block's difficulty.
	indep_hash: Uint8Array // = [] // The hash of the block including `hash` and `nonce` the block identifier.
	txs: string[]  // A list of tx records in full blocks or a list of TX identifiers in block shadows.
	tx_root: Uint8Array // = <<>> // Merkle root of the tree of transactions' data roots.
	tx_tree: Uint8Array[]  // Merkle tree of transactions' data roots. Not stored.
	hash_list?: Uint8Array[] //  "A list of hashes used for fork recovery 
	wallet_list: Uint8Array // = unset
	reward_addr: string // Address to credit mining reward or the unclaimed atom.
	tags: string[]  // Miner specified tags to store with the block.
	reward_pool: BigNumber  // Current pool of mining rewards.
	weave_size: BigNumber  // Current size of the weave in bytes (counts tx data fields).
	block_size: number  // The total size of transaction data inside this block.
	cumulative_diff: BigNumber  // The sum of average number of hashes tried to mine blocks over all previous blocks.
	hash_list_merkle: Uint8Array //The merkle root of the block index.
	poa: Poa // The access proof used to generate this block.

	constructor(dto: BlockDTO){
		this.nonce = dto.nonce
		this.previous_block = Arweave.utils.b64UrlToBuffer(dto.previous_block)
		this.timestamp = dto.timestamp
		this.last_retarget = dto.last_retarget
		this.diff = new BigNumber(dto.diff)
		this.height = dto.height
		this.hash = Arweave.utils.b64UrlToBuffer(dto.hash)
		this.indep_hash = Arweave.utils.b64UrlToBuffer(dto.indep_hash)
		this.txs = [] 																														//!!! <- need to finish this later !,
		this.tx_root = Arweave.utils.b64UrlToBuffer(dto.tx_root)
		this.tx_tree = [] // dto.tx_tree.map(b64urlTxHash=>Arweave.utils.b64UrlToBuffer(b64urlTxHash)) //!!! need to do this later!!,
		this.wallet_list = Arweave.utils.b64UrlToBuffer(dto.wallet_list)
		this.reward_addr = dto.reward_addr
		this.tags = dto.tags
		this.reward_pool = new BigNumber(dto.reward_pool)
		this.weave_size = new BigNumber(dto.weave_size)
		this.block_size = dto.block_size
		this.cumulative_diff = new BigNumber(dto.cumulative_diff)
		this.hash_list_merkle = Arweave.utils.b64UrlToBuffer(dto.hash_list_merkle)
		this.poa = {
			option: parseInt(dto.poa.option),
			tx_path: Arweave.utils.b64UrlToBuffer(dto.poa.tx_path),
			data_path: Arweave.utils.b64UrlToBuffer(dto.poa.data_path),
			chunk: Arweave.utils.b64UrlToBuffer(dto.poa.chunk)
		}	
	}
}

// export const blockDtoToBlock = (dto: BlockDTO): Block => {
// 	let block: Block = {
// 		nonce: dto.nonce,
// 		previous_block: Arweave.utils.b64UrlToBuffer(dto.previous_block),
// 		timestamp: dto.timestamp,
// 		last_retarget: dto.last_retarget,
// 		diff: new BigNumber(dto.diff),
// 		height: dto.height,
// 		hash: Arweave.utils.b64UrlToBuffer(dto.hash),
// 		indep_hash: Arweave.utils.b64UrlToBuffer(dto.indep_hash),
// 		txs: [], 																															//!!! <- need to finish this later !,
// 		tx_root: Arweave.utils.b64UrlToBuffer(dto.tx_root),
// 		tx_tree: [], // dto.tx_tree.map(b64urlTxHash=>Arweave.utils.b64UrlToBuffer(b64urlTxHash)) //!!! need to do this later!!,
// 		wallet_list: Arweave.utils.b64UrlToBuffer(dto.wallet_list),
// 		reward_addr: dto.reward_addr,
// 		tags: dto.tags,
// 		reward_pool: new BigNumber(dto.reward_pool),
// 		weave_size: new BigNumber(dto.weave_size),
// 		block_size: dto.block_size,
// 		cumulative_diff: new BigNumber(dto.cumulative_diff),
// 		hash_list_merkle: Arweave.utils.b64UrlToBuffer(dto.hash_list_merkle),
// 		poa: {
// 			option: parseInt(dto.poa.option),
// 			tx_path: Arweave.utils.b64UrlToBuffer(dto.poa.tx_path),
// 			data_path: Arweave.utils.b64UrlToBuffer(dto.poa.data_path),
// 			chunk: Arweave.utils.b64UrlToBuffer(dto.poa.chunk)
// 		}
// 	}
// 	if(dto.hash_list){ 
// 		block.hash_list = dto.hash_list.map(b64url=>Arweave.utils.b64UrlToBuffer(b64url)) 
// 	}

// 	return block
// }

