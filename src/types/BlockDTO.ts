import { Tag } from './Tag'

/* Template for a Block "Data Transfer Object" for use in the http API */
export class BlockDTO {
	nonce: string								// The nonce used to satisfy the PoW problem when mined. Base64Url string
	previous_block: string			// indep_hash of the previous block in the weave.
	timestamp: number 					// POSIX time of block discovery.
	last_retarget: number				// POSIX time of the last difficulty retarget.
	diff: string								// The PoW difficulty - the number a PoW hash must be greater than.
	height: number							// How many blocks have passed since the genesis block.
	hash: string 								// PoW hash of the block must satisfy the block's difficulty.
	indep_hash: string					// Blocki ID. The hash of the block including `hash` and `nonce`.
	txs: string[]								// List of TX identifiers in block. Base64url strings.
	tx_root: string							// Merkle root of the tree of transactions' data roots.
	tx_tree: string[]						// Merkle tree of transactions' data roots. Not stored.
	// hash_list?:string[]			// Not stored in DTO.  
	wallet_list:string					// Large download, retrieve separately. List of all wallets and balances
	reward_addr:string					// Address to credit mining reward
	tags:Tag[]									// Unused? Miner specified tags to store with the block.
	reward_pool:number					// Current pool of mining rewards.
	weave_size:number						// Current size of the weave in bytes (counts tx data fields).
	block_size:number						// The total size of transaction data inside this block.
	cumulative_diff:string			//The sum of average number of hashes tried to mine blocks over all previous blocks.
	hash_list_merkle:string			// The merkle root of the block index.
	poa: PoaDTO									// The PoA (Proof of Access) used to generate this block.
}

/* A proof of access to a recall byte found in a TX. */
class PoaDTO {
	option: string							// Number. The recall byte option (a sequence number) chosen.
	tx_path: string							// Base64url encoded. Path through the Merkle tree of TXs in the block.
	data_path: string						// Path through the Merkle tree of chunk IDs to the required chunk.
	chunk: string								// The required data chunk.
}
