import { HOST_SERVER } from './constants'
import { BlockDTO, Tag } from './types'
import Arweave from 'arweave'
import Axios from 'axios'
import deepHash from './utils/deepHash'
import { Poa } from './Poa'
import { arrayCompare } from './utils/buffer-utilities'


/* Actual binary data for a Block. Usually translated from a Block JSON Data Transfer Object */
export class Block {
	/* member variables, for more details see BlockJson.ts */
	nonce: Uint8Array // The nonce used to satisfy the PoW problem when mined.
	previous_block: Uint8Array // indep_hash of the previous block in the weave.
	timestamp: number // POSIX time of block discovery.
	last_retarget: number // POSIX time of the last difficulty retarget.
	diff: number  // Mining difficulty. Floats must be used to match erlang maths
	diffString: string  // Original string must be used to match hashing
	height:number // How many blocks have passed since the genesis block.
	hash: Uint8Array // PoW hash of the block must satisfy the block's difficulty.
	indep_hash: Uint8Array // = [] // The hash of the block including `hash` and `nonce` the block identifier.
	txs: Uint8Array[]  // A list of tx records in full blocks or a list of TX identifiers in block shadows.
	tx_root: Uint8Array // = <<>> // Merkle root of the tree of transactions' data roots.
	tx_tree: Uint8Array[]  // Merkle tree of transactions' data roots. Not stored.
	hash_list?: Uint8Array[] //  "A list of hashes used for fork recovery 
	wallet_list: Uint8Array // = unset
	reward_addr: Uint8Array // Address to credit mining reward or the unclaimed atom.
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
		this.diff = Number(dto.diff)
		this.diffString = dto.diff
		this.height = dto.height
		this.hash = Arweave.utils.b64UrlToBuffer(dto.hash)
		this.indep_hash = Arweave.utils.b64UrlToBuffer(dto.indep_hash)
		this.txs = dto.txs.map(txid=>Arweave.utils.b64UrlToBuffer(txid))
		this.tx_root = Arweave.utils.b64UrlToBuffer(dto.tx_root)
		this.tx_tree = [] // dto.tx_tree.map(b64urlTxHash=>Arweave.utils.b64UrlToBuffer(b64urlTxHash)) //!!! need to do this later!!,
		this.wallet_list = Arweave.utils.b64UrlToBuffer(dto.wallet_list)
		this.reward_addr = Arweave.utils.b64UrlToBuffer(dto.reward_addr) // N.B. should be set to `new Uint8Array("unclaimed")` when mining
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

	/* Some convenience functions */
	static async getByHeight(height: number): Promise<Block> {
		let blockJson = (await Axios.get(HOST_SERVER+'/block/height/'+height)).data
		return new Block(blockJson)
	}
	static async getByHash(hash: Uint8Array): Promise<Block> {
		let b64url = Arweave.utils.bufferTob64Url(hash)
		let blockJson = (await Axios.get(HOST_SERVER+'/block/hash/'+b64url)).data
		return new Block(blockJson)
	}
	static async getCurrent(): Promise<Block> {
		let blockJson = (await Axios.get(HOST_SERVER+'/block/current')).data
		return new Block(blockJson)
	}
}

export const getIndepHash = async (block: Block): Promise<Uint8Array> => {
	/*
		indep_hash_post_fork_2_0(B) ->
			BDS = ar_block:generate_block_data_segment(B),
			indep_hash_post_fork_2_0(BDS, B#block.hash, B#block.nonce).

		indep_hash_post_fork_2_0(BDS, Hash, Nonce) ->
			ar_deep_hash:hash([BDS, Hash, Nonce]).
	*/
	let BDS: Uint8Array = await generateBlockDataSegment(block)

	return await deepHash([
		BDS, 
		block.hash, 
		block.nonce,
	])
}

export const generateBlockDataSegment = async (block: Block): Promise<Uint8Array> => {
	/*
		%% @doc Generate a block data segment.
		%% Block data segment is combined with a nonce to compute a PoW hash.
		%% Also, it is combined with a nonce and the corresponding PoW hash
		%% to produce the independent hash.
		generate_block_data_segment(B) ->
			generate_block_data_segment(
				generate_block_data_segment_base(B),
				B#block.hash_list_merkle,
				#{
					timestamp => B#block.timestamp,
					last_retarget => B#block.last_retarget,
					diff => B#block.diff,
					cumulative_diff => B#block.cumulative_diff,
					reward_pool => B#block.reward_pool,
					wallet_list => B#block.wallet_list
				}
			).

		generate_block_data_segment(BDSBase, BlockIndexMerkle, TimeDependentParams) ->
			#{
				timestamp := Timestamp,
				last_retarget := LastRetarget,
				diff := Diff,
				cumulative_diff := CDiff,
				reward_pool := RewardPool,
				wallet_list := WalletListHash
			} = TimeDependentParams,
			ar_deep_hash:hash([
				BDSBase,
				integer_to_binary(Timestamp),
				integer_to_binary(LastRetarget),
				integer_to_binary(Diff),
				integer_to_binary(CDiff),
				integer_to_binary(RewardPool),
				WalletListHash,
				BlockIndexMerkle
			]).
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
		%% @doc Generate a hash, which is used to produce a block data segment
		%% when combined with the time-dependent parameters, which frequently
		%% change during mining - timestamp, last retarget timestamp, difficulty,
		%% cumulative difficulty, miner's wallet, reward pool. Also excludes
		%% the merkle root of the block index, which is hashed with the rest
		%% as the last step, to allow verifiers to quickly validate PoW against
		%% the current state.
		generate_block_data_segment_base(B) ->
			BDSBase = ar_deep_hash:hash([
				integer_to_binary(B#block.height),
				B#block.previous_block,
				B#block.tx_root,
				lists:map(fun ar_weave:tx_id/1, B#block.txs),
				integer_to_binary(B#block.block_size),
				integer_to_binary(B#block.weave_size),
				case B#block.reward_addr of
					unclaimed ->
						<<"unclaimed">>;
					_ ->
						B#block.reward_addr
				end,
				ar_tx:tags_to_list(B#block.tags),
				poa_to_list(B#block.poa)
			]),
			BDSBase.

		poa_to_list(POA) ->
			[
				integer_to_binary(POA#poa.option),
				POA#poa.tx_path,
				POA#poa.data_path,
				POA#poa.chunk
			].
	*/

	return await deepHash([
		Arweave.utils.stringToBuffer(block.height.toString()),
		block.previous_block,
		block.tx_root,
		block.txs,	
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

export const blockVerifyDepHash = (block: Block, pow: Uint8Array) => {
	return arrayCompare(block.hash, pow)
}