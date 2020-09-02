import { HOST_SERVER } from './constants'
import { BlockDTO, Tag } from './types'
import Arweave from 'arweave'
import Axios from 'axios'
import deepHash from './utils/deepHash'
import { Poa } from './Poa'
import { arrayCompare } from './utils/buffer-utilities'
import { Tx } from './Tx'


/* Actual binary data for a Block. Usually translated from a Block JSON Data Transfer Object */
export class Block {
	/* member variables, for more details see BlockJson.ts */
	nonce: Uint8Array // The nonce used to satisfy the PoW problem when mined.
	previous_block: Uint8Array // indep_hash of the previous block in the weave.
	timestamp: bigint // POSIX time of block discovery.
	last_retarget: bigint // POSIX time of the last difficulty retarget.
	diff: bigint  // Mining difficulty. Floats must be used to match erlang maths
	diffString: string  // Original string must be used to match hashing
	height:number // How many blocks have passed since the genesis block.
	hash: Uint8Array // PoW hash of the block must satisfy the block's difficulty.
	indep_hash: Uint8Array // = [] // The hash of the block including `hash` and `nonce` the block identifier.
	txids: Uint8Array[]  //  a list of TX identifiers 
	txs: Tx[]  // A list of Tx objects 
	tx_root: Uint8Array // = <<>> // Merkle root of the tree of transactions' data roots.
	tx_tree: Uint8Array[]  // Merkle tree of transactions' data roots. Not stored.
	hash_list?: Uint8Array[] //  "A list of hashes used for fork recovery 
	wallet_list: Uint8Array // = unset
	reward_addr: Uint8Array // Address to credit mining reward or the unclaimed atom.
	tags: Tag[]  // Miner specified tags to store with the block.
	reward_pool: bigint  // Current pool of mining rewards.
	weave_size: bigint  // Current size of the weave in bytes (counts tx data fields).
	block_size: number  // The total size of transaction data inside this block.
	cumulative_diff: bigint  // The sum of average number of hashes tried to mine blocks over all previous blocks.
	hash_list_merkle: Uint8Array //The merkle root of the block index.
	poa: Poa // The access proof used to generate this block.

	static async createFromDTO(dto: BlockDTO){
		let b = new Block()
		b.nonce = Arweave.utils.b64UrlToBuffer(dto.nonce)
		b.previous_block = Arweave.utils.b64UrlToBuffer(dto.previous_block)
		b.timestamp = BigInt(dto.timestamp)
		b.last_retarget = BigInt(dto.last_retarget)
		b.diff = BigInt(dto.diff)
		b.diffString = dto.diff
		b.height = dto.height
		b.hash = Arweave.utils.b64UrlToBuffer(dto.hash)
		b.indep_hash = Arweave.utils.b64UrlToBuffer(dto.indep_hash)
		b.txids = dto.txs.map(txid=>Arweave.utils.b64UrlToBuffer(txid))

		let promises: Promise<Tx>[] = dto.txs.map( txid => Tx.getByIdString(txid) )
		b.txs = await Promise.all( promises )
		b.tx_root = Arweave.utils.b64UrlToBuffer(dto.tx_root)
		b.tx_tree = [] // dto.tx_tree.map(b64urlTxHash=>Arweave.utils.b64UrlToBuffer(b64urlTxHash)) //!!! need to do this later!!,
		b.wallet_list = Arweave.utils.b64UrlToBuffer(dto.wallet_list)
		b.reward_addr = Arweave.utils.b64UrlToBuffer(dto.reward_addr) // N.B. should be set to `new Uint8Array("unclaimed")` when mining
		b.tags = dto.tags.map((tag:Tag) => {
			return { 
				name: Arweave.utils.b64UrlToString(tag.name), 
				value: Arweave.utils.b64UrlToString(tag.value) 
			}
		})
		b.reward_pool = BigInt(dto.reward_pool)
		b.weave_size = BigInt(dto.weave_size)
		b.block_size = dto.block_size
		b.cumulative_diff = BigInt(dto.cumulative_diff)
		b.hash_list_merkle = Arweave.utils.b64UrlToBuffer(dto.hash_list_merkle)
		b.poa = {
			option: parseInt(dto.poa.option),
			tx_path: Arweave.utils.b64UrlToBuffer(dto.poa.tx_path),
			data_path: Arweave.utils.b64UrlToBuffer(dto.poa.data_path),
			chunk: Arweave.utils.b64UrlToBuffer(dto.poa.chunk)
		}	
		if(dto.hash_list){ 
			b.hash_list = dto.hash_list.map(b64url=>Arweave.utils.b64UrlToBuffer(b64url)) 
		}
		return b
	}

	/* Some convenience functions */
	static async getByHeight(height: number): Promise<Block> {
		let blockJson = (await Axios.get(HOST_SERVER+'/block/height/'+height)).data
		return await Block.createFromDTO(blockJson)
	}
	static async getByHash(hash: Uint8Array): Promise<Block> {
		let b64url = Arweave.utils.bufferTob64Url(hash)
		let blockJson = (await Axios.get(HOST_SERVER+'/block/hash/'+b64url)).data
		return await Block.createFromDTO(blockJson)
	}
	static async getCurrent(): Promise<Block> {
		let blockJson = (await Axios.get(HOST_SERVER+'/block/current')).data
		return await Block.createFromDTO(blockJson)
	}
	
}

export const getIndepHash = async (block: Block): Promise<Uint8Array> => {

	let BDS: Uint8Array = await generateBlockDataSegment(block)

	return await deepHash([
		BDS, 
		block.hash, 
		block.nonce,
	])
}

export const generateBlockDataSegment = async (block: Block): Promise<Uint8Array> => {
	/*
		Generate a block data segment.
		Block data segment is combined with a nonce to compute a PoW hash.
		Also, it is combined with a nonce and the corresponding PoW hash
		to produce the independent hash.
	*/
	let BDSBase: Uint8Array = await generateBlockDataSegmentBase(block)

	return await deepHash([
		BDSBase,
		Arweave.utils.stringToBuffer(block.timestamp.toString()),
		Arweave.utils.stringToBuffer(block.last_retarget.toString()),
		Arweave.utils.stringToBuffer(block.diffString),
		Arweave.utils.stringToBuffer(block.cumulative_diff.toString()),
		Arweave.utils.stringToBuffer(block.reward_pool.toString()),
		block.wallet_list,
		block.hash_list_merkle,
	])
}

export const generateBlockDataSegmentBase = async (block: Block): Promise<Uint8Array> => {
	/*
		Generate a hash, which is used to produce a block data segment
		when combined with the time-dependent parameters, which frequently
		change during mining - timestamp, last retarget timestamp, difficulty,
		cumulative difficulty, miner's wallet, reward pool. Also excludes
		the merkle root of the block index, which is hashed with the rest
		as the last step, to allow verifiers to quickly validate PoW against
		the current state.
	*/

	return await deepHash([
		Arweave.utils.stringToBuffer(block.height.toString()),
		block.previous_block,
		block.tx_root,
		block.txids,	
		Arweave.utils.stringToBuffer(block.block_size.toString()),
		Arweave.utils.stringToBuffer(block.weave_size.toString()),
		block.reward_addr, // N.B. this should be `new Uint8Array("unclaimed")` when mining
		block.tags.map((tag: Tag) => [
			Arweave.utils.stringToBuffer(tag.name), 		
			Arweave.utils.stringToBuffer(tag.value),
		]),
		[
			Arweave.utils.stringToBuffer(block.poa.option.toString()),
			block.poa.tx_path,
			block.poa.data_path,
			block.poa.chunk,
		]
	])
}

export const block_verifyDepHash = (block: Block, pow: Uint8Array) => {
	return arrayCompare(block.hash, pow)
}