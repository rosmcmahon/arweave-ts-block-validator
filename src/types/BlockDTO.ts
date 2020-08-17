import { DEFAULT_DIFF } from '../constants'

/* Template for a Block "Data Transfer Object" for use in the http API */
export class BlockDTO {
	nonce: string = '' //= <<>> // The nonce used to satisfy the PoW problem when mined.
	previous_block: string ='' // = <<>> // indep_hash of the previous block in the weave.
	timestamp: number = Math.round((new Date()).getTime() / 1000) // = os:system_time(seconds) // POSIX time of block discovery.
	last_retarget: number = -1 // POSIX time of the last difficulty retarget.
	diff:string = DEFAULT_DIFF.toString() // The PoW difficulty - the number a PoW hash must be greater than.
	height:number = -1 // How many blocks have passed since the genesis block.
	hash:string // PoW hash of the block must satisfy the block's difficulty.
	indep_hash:string // = [] // The hash of the block including `hash` and `nonce` the block identifier.
	txs:string[] = [] // A list of tx records in full blocks or a list of TX identifiers in block shadows.
	tx_root:string // = <<>> // Merkle root of the tree of transactions' data roots.
	tx_tree:string[] = [] // Merkle tree of transactions' data roots. Not stored.
	//// A list of all previous independent hashes. Not returned in the /block/[hash] API endpoint.
	//// In the block shadows only the last ?STORE_BLOCKS_BEHIND_CURRENT hashes are included.
	//// Reconstructed on the receiving side. Not stored in the block files.
	hash_list?:string[] // = unset // "A list of hashes in the v1 format used for fork recovering through the fork 2.0 switch. 
	//// Neither stored, gossiped, nor returned in the API, only used for constructing the hash list for a block shadow."
	//// Alt: "gossiped blocks have a hash_list field, with 50 hashes of the previous blocks, from recent to oldest - the node 
	//// uses it to decide if it is the same fork or, if not, initiate a fork recovery process from the corresponding base hash (the intersection)	
	wallet_list:string // = unset
	reward_addr:string // = unclaimed // Address to credit mining reward or the unclaimed atom.
	tags:string[] = [] // Miner specified tags to store with the block.
	reward_pool:number = 0 // Current pool of mining rewards.
	weave_size:number = 0 // Current size of the weave in bytes (counts tx data fields).
	block_size:number = 0 // The total size of transaction data inside this block.
	//// The sum of average number of hashes tried to mine blocks over all previous blocks.
	cumulative_diff:string = '0'
	hash_list_merkle:string // = <<>> // The merkle root of the block index.
	//// The root hash of all the wallets in the weave at this block.
	////
	//// Before 2.2 the hash is the merkle root of an unbalanced binary tree of wallets.
	//// From 2.2 onwards wallets are organized as a tree closely resembling Patricia Merkle trees.
	//// Each node in the tree stores the hash of its subtree what allows to efficiently
	//// recompute the hash of the whole collection - it scales with the number of transactions in
	//// the block not with the total number of wallets in the weave. Such a tree has an advantage
	//// over the binary tree because there is a hard cap on the number of operations which may be
	//// required for recomputing the root hash after a single insert - 32 (key length) * 2 ^ 8.
	//// A binary tree on the other hand requires periodic rebalancing otherwise the complexity
	//// of operations may approach O(number of wallets).
	poa: PoaDTO // The access proof used to generate this block.
}

interface PoaDTO {
	// %// @doc A succinct proof of access to a recall byte found in a TX.
		option:string //= "1" // The recall byte option (a sequence number) chosen.
		tx_path:string // b64url encoded concatanation of hashes? // Path through the Merkle tree of TXs in the block.
		data_path:string // b64url encoded concatanation of hashes? // Path through the Merkle tree of chunk IDs to the required chunk.
		chunk:string // b64url encoded data // The required data chunk.
}