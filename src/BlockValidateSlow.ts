import { ReturnCode, Tag, BlockIndexTuple, Poa } from  './types'
import {  } from './constants'
import { Block } from './Block'
import { BigNumber } from 'bignumber.js'
import deepHash from './utils/deepHash'
import Arweave from 'arweave'

export const validateBlockSlow = async (block: Block, prevBlock: Block, blockIndex: BlockIndexTuple[]): Promise<ReturnCode> => {
	/* 13 steps for slow validation (ref: validate in ar_node_utils.erl) */

	// 1. Verify the height of the new block is the one higher than the current height.
	if(block.height !== prevBlock.height + 1){
		return {code: 400, message: "Invalid height"}
	}

	// 2. Verify that the previous_block hash of the new block is the indep_hash of the current block.
	if( ! Buffer.from(prevBlock.indep_hash).equals(block.previous_block) ){
		return {code: 400, message: "Invalid previous_block"}
	}

	// 3. poa:
	// if(! ar_poa:validate(OldB#block.indep_hash, OldB#block.weave_size, BI, POA) ) return false
	if( ! validatePoa(prevBlock.indep_hash, prevBlock.weave_size, blockIndex, block.poa) ){
		return {code: 400, message: "Invalid PoA"}
	}

	// 4. difficulty:
	// if(! ar_retarget:validate_difficulty(NewB, OldB) ) return false
	
	// 5. pow:
	// POW = ar_weave:hash( ar_block:generate_block_data_segment(NewB), Nonce, Height );
	// if(! ar_mine:validate(POW, ar_poa:modify_diff(Diff, POA#poa.option), Height) ) return false
	// if(! ar_block:verify_dep_hash(NewB, POW) ) return false

	// 6. independent_hash:
	// if( ar_weave:indep_hash_post_fork_2_0(NewB) != NewB#block.indep_hash ) return false
	let indepHash = await getIndepHash(block)
	if( ! Buffer.from(indepHash).equals(block.indep_hash) ){
		return {code: 400, message: "Invalid independent hash"}
	}

	// 7. wallet_list:
	// get old block reward & height 
	// UpdatedWallets = update_wallets(NewB, Wallets, RewardPool, Height)
	// if(any wallets are invalid) return false

	// 8. block_field_sizes:
	// if(! ar_block:block_field_size_limit(NewB) ) return false

	// 9. txs:
	// if( ar_tx_replay_pool:verify_block_txs === invalid ) return false

	// 10. tx_root:
	// ar_block:verify_tx_root(NewB) === false; return false

	// 11. weave_size:
	// ar_block:verify_weave_size(NewB, OldB, TXs) === false; return false

	// 12. block_index_root:
	// ar_block:verify_block_hash_list_merkle(NewB, OldB, BI) === false; return false

	// 13. last_retarget:
	// ar_block:verify_last_retarget(NewB, OldB) === false; return false

	return {code:200, message:"Block slow check OK"}
}

export const validatePoa = async (
	prevIndepHash: Uint8Array, 
	prevWeaveSize: number, 
	blockIndex: BlockIndexTuple[], 
	poa: Poa
): Promise<Boolean> => {
	return true
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
		Arweave.utils.stringToBuffer(block.diff.toString()),
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
		block.reward_addr, 						// N.B. this should be set to ` new Uint8Array("unclaimed") ` when we are mining
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