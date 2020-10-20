import { FORK_HEIGHT_1_8, DATA_CHUNK_SIZE, MAX_PATH_SIZE, FORK_HEIGHT_2_0 } from '../constants'
import { BlockDTO, Tag } from '../types'
import Arweave from 'arweave'
import deepHash from '../utils/deepHash'
import { Poa } from './Poa'
import { arrayCompare, bufferToInt } from '../utils/buffer-utilities'
import { Tx } from './Tx'
import { MerkleElement, computeRootHash } from '../utils/merkle'
import { unbalancedMerkle_root, unbalancedMerkle_hashBlockIndexEntry } from '../utils/unbalanced-merkle'


/* Binary data for a Block. Usually translated from a Block JSON Data Transfer Object (BlockDTO) */

export class Block {
	nonce: Uint8Array							// The nonce used to satisfy the PoW problem when mined.
	previous_block: Uint8Array 		// Block ID (indep_hash) of the previous block in the weave.
	timestamp: bigint 						// POSIX time of block discovery.
	last_retarget: bigint 				// POSIX time of the last difficulty retarget.
	diff: bigint  								// Mining (PoW) difficulty. The number a PoW hash must be greater than.
	diffString: string						// Original string must be used to match hashing
	height:number									// How many blocks have passed since the genesis block.
	hash: Uint8Array 							// PoW hash of the block must satisfy the block's difficulty.
	indep_hash: Uint8Array 				// Block ID. The hash of the block including `hash` and `nonce`.
	txids: Uint8Array[]  					// List of the block's Tx identifiers 
	txs: Tx[]  										// List of the block's actual Tx objects 
	tx_root: Uint8Array						// Merkle root of the tree of transactions' data roots.
	tx_tree: Uint8Array[]					// Merkle tree of transactions' data roots.
	hash_list?: Uint8Array[]			// A list of hashes used for fork recovery 
	wallet_list: Uint8Array				// Large separate download before fork_2_2. After for_2_2 contains a hash root of wallets tree
	reward_addr: Uint8Array				// Address to credit mining reward or the unclaimed atom.
	tags: Tag[]  									// Unused? Miner specified tags to store with the block.
	reward_pool: bigint						// Current pool of mining rewards.
	weave_size: bigint						// Current size of the weave in bytes (counts tx data fields).
	block_size: bigint  					// The total size of transaction data inside this block.
	cumulative_diff: bigint 			// The sum of average number of hashes tried to mine blocks over all previous blocks.
	hash_list_merkle: Uint8Array	// The merkle root of the block index.
	poa: Poa											// The access proof used to generate this block.

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
		b.tx_tree = dto.tx_tree.map(b64urlTxHash=>Arweave.utils.b64UrlToBuffer(b64urlTxHash)) //Unused in DTO?
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
		b.block_size = BigInt(dto.block_size)
		b.cumulative_diff = BigInt(dto.cumulative_diff)
		b.hash_list_merkle = Arweave.utils.b64UrlToBuffer(dto.hash_list_merkle)
		b.poa = {
			option: parseInt(dto.poa.option),
			tx_path: Arweave.utils.b64UrlToBuffer(dto.poa.tx_path),
			data_path: Arweave.utils.b64UrlToBuffer(dto.poa.data_path),
			chunk: Arweave.utils.b64UrlToBuffer(dto.poa.chunk)
		}	
	
		return b
	}
	
}

export const getIndepHash = async (block: Block) => {

	let BDS: Uint8Array = await generateBlockDataSegment(block)

	let deep =  await deepHash([
		BDS, 
		block.hash, 
		block.nonce,
	])
	return new Uint8Array(deep)
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

export const verifyBlockDepHash = (block: Block, pow: Uint8Array) => {
	return arrayCompare(block.hash, pow)
}

export const blockFieldSizeLimit = (block: Block) => {
	if(block.height<FORK_HEIGHT_1_8) throw new Error("Block.blockFieldSizeLimit < FORK_HEIGHT_1_8 not implenented")
	// if( Arweave.utils.bufferToString(block.reward_addr) === "unclaimed" ) <- needs to be implemented for mining

	let diffBytesLimit = 78
	let chunkSize = block.poa.chunk.length
	let dataPathSize = block.poa.data_path.length

	return block.nonce.length <= 512
		&& block.previous_block.length <= 48 
		&& block.timestamp.toString().length <= 12
		&& block.last_retarget.toString().length <= 12
		&& block.diff.toString().length <= diffBytesLimit
		&& block.height.toString().length <= 20
		&& block.hash.length <= 48
		&& block.indep_hash.length <= 48
		&& block.reward_addr.length <= 32
		&& getTagsLength(block.tags) <= 2048
		&& block.weave_size.toString().length <= 64
		&& block.block_size.toString().length <= 64
		&& chunkSize <= DATA_CHUNK_SIZE
		&& dataPathSize <= MAX_PATH_SIZE
}

const getTagsLength = (tags: Tag[]) => {
	let total = 0
	for (let i = 0; i < tags.length; i++) {
		const tag = tags[i];
		total += tag.name.length + tag.value.length
	}
	return total
}

export const  block_verifyWeaveSize = (block: Block, prevBlock: Block) => {
	let newSize = prevBlock.weave_size
	let txs = block.txs
	for (let i = 0; i < txs.length; i++) {
		const tx = txs[i];
		newSize += tx.data_size
	}

	return block.weave_size === newSize
}

export const block_verifyBlockHashListMerkle = async (block: Block, prevBlock: Block) => {
	if(block.height<FORK_HEIGHT_2_0) throw new Error("Unavailable: block_verifyBlockHashListMerkle < FORK_HEIGHT_2_0")

	// Check that the given merkle root in a new block is valid.
	return arrayCompare(
		block.hash_list_merkle, 
		await unbalancedMerkle_root(
			prevBlock.hash_list_merkle,
			await unbalancedMerkle_hashBlockIndexEntry(prevBlock.indep_hash, prevBlock.weave_size, prevBlock.tx_root)
		)
	)
}

export const block_verifyTxRoot = async (block: Block) => {
	return arrayCompare(block.tx_root, await generateTxRootForBlock(block.txs))
}

const generateTxRootForBlock = async (txs: Tx[]) => {
	if(txs.length ===0){
		return new Uint8Array(0)
	}

	let sizeTaggedTxs = await generateSizeTaggedList(txs)
	let sizeTaggedDataRoots = generateSizeTaggedDataRootsStructure(sizeTaggedTxs)
	const root = await computeRootHash(sizeTaggedDataRoots) 

	return root
}

const generateSizeTaggedDataRootsStructure = (sizeTaggedTxs: SizeTagged[]): MerkleElement[] => {
	return sizeTaggedTxs.map( sizeTagged => {
		let { data, offset } = sizeTagged
		let { root } = data
		return { data: root, note: offset }
	})
}

interface SizeTagged {
	data: {
		id: Uint8Array
		root: Uint8Array
	},
	offset: bigint
}

const generateSizeTaggedList = async (txs: Tx[]) => {

	// first sort the txs by format then id
	let sortedTxs = sortTxs(txs)

	// do the fold on these sortedTxs and reverse the output array
	let pos = 0n
	let list: SizeTagged[] = []
	for (let i = 0; i < sortedTxs.length; i++) {
		const tx = sortedTxs[i];
		pos += tx.data_size
		list = [
			...list,
			{ data: {id: tx.id, root: await tx.getDataRoot() }, offset: pos },
		]
	}

	return list 
}

const sortTxs = (txs: Tx[]) => {
	// sort the txs by format then id
	let idSort = txs.sort((a,b) => bufferToInt(a.id) - bufferToInt(b.id))
	let formatSort = idSort.sort((a,b) => a.format - b.format)
	return formatSort
}

