import { Poa, BlockDTO, Tag } from './types'
import { BigNumber } from 'bignumber.js'
import Arweave from 'arweave'
import Axios from 'axios'

/* Actual binary data for a Block. Usually translated from a Block JSON Data Transfer Object */
export class Block {
	/* member variables, for more details see BlockJson.ts */
	nonce: Uint8Array // The nonce used to satisfy the PoW problem when mined.
	previous_block: Uint8Array // indep_hash of the previous block in the weave.
	timestamp: number // POSIX time of block discovery.
	last_retarget: number // POSIX time of the last difficulty retarget.
	diff: string  // The PoW difficulty - the number a PoW hash must be greater than.
	height:number // How many blocks have passed since the genesis block.
	hash: Uint8Array // PoW hash of the block must satisfy the block's difficulty.
	indep_hash: Uint8Array // = [] // The hash of the block including `hash` and `nonce` the block identifier.
	txs: string[]  // A list of tx records in full blocks or a list of TX identifiers in block shadows.
	tx_root: Uint8Array // = <<>> // Merkle root of the tree of transactions' data roots.
	tx_tree: Uint8Array[]  // Merkle tree of transactions' data roots. Not stored.
	hash_list?: Uint8Array[] //  "A list of hashes used for fork recovery 
	wallet_list: Uint8Array // = unset
	reward_addr: string // Address to credit mining reward or the unclaimed atom.
	tags: Tag[]  // Miner specified tags to store with the block.
	reward_pool: number  // Current pool of mining rewards.
	weave_size: number  // Current size of the weave in bytes (counts tx data fields).
	block_size: number  // The total size of transaction data inside this block.
	cumulative_diff: string  // The sum of average number of hashes tried to mine blocks over all previous blocks.
	hash_list_merkle: Uint8Array //The merkle root of the block index.
	poa: Poa // The access proof used to generate this block.

	constructor(dto: BlockDTO){
		this.nonce = Arweave.utils.b64UrlToBuffer(dto.nonce)
		this.previous_block = Arweave.utils.b64UrlToBuffer(dto.previous_block)
		this.timestamp = dto.timestamp
		this.last_retarget = dto.last_retarget
		this.diff = dto.diff
		this.height = dto.height
		this.hash = Arweave.utils.b64UrlToBuffer(dto.hash)
		this.indep_hash = Arweave.utils.b64UrlToBuffer(dto.indep_hash)
		this.txs = dto.txs
		this.tx_root = Arweave.utils.b64UrlToBuffer(dto.tx_root)
		this.tx_tree = [] // dto.tx_tree.map(b64urlTxHash=>Arweave.utils.b64UrlToBuffer(b64urlTxHash)) //!!! need to do this later!!,
		this.wallet_list = Arweave.utils.b64UrlToBuffer(dto.wallet_list)
		this.reward_addr = dto.reward_addr
		this.tags = dto.tags.map((tag:Tag) => {
			return { 
				name: Arweave.utils.b64UrlToString(tag.name), 
				value: Arweave.utils.b64UrlToString(tag.value) 
			}
		})
		this.reward_pool = dto.reward_pool
		this.weave_size = dto.weave_size
		this.block_size = dto.block_size
		this.cumulative_diff = dto.cumulative_diff
		this.hash_list_merkle = Arweave.utils.b64UrlToBuffer(dto.hash_list_merkle)
		this.poa = {
			option: parseInt(dto.poa.option),
			tx_path: Arweave.utils.b64UrlToBuffer(dto.poa.tx_path),
			data_path: Arweave.utils.b64UrlToBuffer(dto.poa.data_path),
			chunk: Arweave.utils.b64UrlToBuffer(dto.poa.chunk)
		}	
		if(dto.hash_list){ 
			this.hash_list = dto.hash_list.map(b64url=>Arweave.utils.b64UrlToBuffer(b64url)) 
		}
	}

	static async getByHeight(height: number): Promise<Block> {
		let blockJson = (await Axios.get('https://arweave.net/block/height/'+height)).data
		return new Block(blockJson)
	}
	static async getByHash(hash: Uint8Array): Promise<Block> {
		let b64url = Arweave.utils.bufferTob64Url(hash)
		let blockJson = (await Axios.get('https://arweave.net/block/hash/'+b64url)).data
		return new Block(blockJson)
	}
	static async getCurrent(): Promise<Block> {
		let blockJson = (await Axios.get('https://arweave.net/block/current')).data
		return new Block(blockJson)
	}
	

}
