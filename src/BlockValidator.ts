import { ReturnCode, BlockDTO, Tag } from  './types'
import { STORE_BLOCKS_AROUND_CURRENT, FORK_HEIGHT_1_7, FORK_HEIGHT_1_8 } from './constants'
import { Block } from './Block'
import { BigNumber } from 'bignumber.js'
import deepHash from './utils/deepHash'
import Arweave from 'arweave'



export const validateBlockJson = (blockJson: BlockDTO, height: number): ReturnCode => {
	let block: Block
	try {
		block = new Block(blockJson)
	} catch (error) {
		console.log('error',error)
		return {code: 400, message: "Invalid block."}
	}
	return validateBlockQuick(block, height)
}

export const validateBlockQuick = (block: Block, currentHeight: number):ReturnCode =>{

	/* 4 steps for quick, initial validation (disregarding http bound steps). Return as fast as possible */

	// 1. check block height range is +/- STORE_BLOCKS_BEHIND_CURRENT from current
	if(block.height < currentHeight-STORE_BLOCKS_AROUND_CURRENT) return {code: 400, message: "Height is too far behind"}
	if(block.height > currentHeight+STORE_BLOCKS_AROUND_CURRENT) return {code: 400, message: "Height is too far ahead"}

	/*** This is the most important part (???) ***/
	// 2. check_difficulty( BShadow#block.diff < ar_mine:min_difficulty(BShadow#block.height) )
	if( blockDiffIsLessThanMinDiff(block.diff, block.height) ) return {code: 400, message: "Difficulty too low"}

	// 3. PoW (relies on BDS "block_data_segment")
	// check_pow(
	// 	ar_mine:validate(BDS, BShadow#block.nonce, BShadow#block.diff, BShadow#block.height) !== valid
	// ){
	// 	ban_peer(ip)
	// 	return {400, "Invalid Block Proof of Work"}
	// }
	/////////// The PoW appears to be dependent on the BDS, which we do not have for this part of validation

	// 4. check_timestamp:
	// if( ar_block:verify_timestamp(BShadow) === false){
	// 	post_block_reject_warn(
	// 		ar:warn({post_block_rejected...)
	// 	)
	// 	return {400, "Invalid timestamp."}
	// }
	/*
		%% @doc Verify the block timestamp is not too far in the future nor too far in
		%% the past. We calculate the maximum reasonable clock difference between any
		%% two nodes. This is a simplification since there is a chaining effect in the
		%% network which we don't take into account. Instead, we assume two nodes can
		%% deviate JOIN_CLOCK_TOLERANCE seconds in the opposite direction from each
		%% other.
		verify_timestamp(B) ->
			CurrentTime = os:system_time(seconds),
			MaxNodesClockDeviation = ?JOIN_CLOCK_TOLERANCE * 2 + ?CLOCK_DRIFT_MAX,
			(
				B#block.timestamp =< CurrentTime + MaxNodesClockDeviation
				andalso
				B#block.timestamp >= CurrentTime - lists:sum([
					?MINING_TIMESTAMP_REFRESH_INTERVAL,
					?MAX_BLOCK_PROPAGATION_TIME,
					MaxNodesClockDeviation
				])
			).
	*/
	//////////// Leave check_timestamp for now. Easy to complete

	return {code:200,message:"Block quick check OK"}
}

const blockDiffIsLessThanMinDiff = (blockDiffString: string, height: number): Boolean => {
	/*
	-ifdef(DEBUG).
	min_difficulty(_Height) ->
		1.
	-else.
	min_difficulty(Height) ->
		Diff = case Height >= ar_fork:height_1_7() of
			true ->
				min_randomx_difficulty();
			false ->
				min_sha384_difficulty()
		end,
		case Height >= ar_fork:height_1_8() of
			true ->
				ar_retarget:switch_to_linear_diff(Diff);
			false ->
				Diff
		end.
	-endif.
	*/
	let blockDiff = new BigNumber(blockDiffString)
	let minDiff: BigNumber
	// if(process.env.NODE_ENV !== "production"){
	// 	minDiff = new BigNumber(1)
	// 	return blockDiff.isLessThan(minDiff)
	// }else{
	if(height >= FORK_HEIGHT_1_7){
		minDiff = new BigNumber(MIN_RANDOMX_DIFFICULTY)
	}else{
		minDiff = new BigNumber(MIN_SHA384_DIFFICULTY)
	}
	if(height >= FORK_HEIGHT_1_8){
		minDiff = switchToLinearDiff(minDiff)
	}
	return blockDiff.isLessThan(minDiff)
	// }
}

/*
	-ifdef(DEBUG).
	min_randomx_difficulty() -> 1.
	-else.
	min_randomx_difficulty() -> min_sha384_difficulty() + ?RANDOMX_DIFF_ADJUSTMENT.
	min_sha384_difficulty() -> 31.
*/
// The adjustment of difficutly going from SHA-384 to RandomX.
const RANDOMX_DIFF_ADJUSTMENT = -14
const MIN_SHA384_DIFFICULTY = 31
const MIN_RANDOMX_DIFFICULTY = MIN_SHA384_DIFFICULTY + RANDOMX_DIFF_ADJUSTMENT

const switchToLinearDiff = (diff: BigNumber) => {
	/*
		%% @doc The number a hash must be greater than, to give the same odds of success
		%% as the old-style Diff (number of leading zeros in the bitstring).
		switch_to_linear_diff(Diff) ->
			erlang:trunc(math:pow(2, 256)) - erlang:trunc(math:pow(2, 256 - Diff)).
	*/
	// return Math.trunc( Math.pow(2, 256) ) - Math.trunc( Math.pow(2, (256 - diff)) )
	let a: BigNumber = (new BigNumber(2)).pow(256).integerValue(BigNumber.ROUND_DOWN)
	let power: BigNumber = (new BigNumber(256)).minus(diff)
	let b: BigNumber = (new BigNumber(2)).pow(power).integerValue(BigNumber.ROUND_DOWN)
	
	// console.log('a',a.toString())
	// console.log('diff',diff.toString())
	// console.log('power',power.toString())
	// console.log('b',b.toString())
	// console.log('a.minus(b)',a.minus(b).toString())

	return  a.minus(b)
}

export const validateBlockSlow = async (block: Block, prevBlock: Block): Promise<ReturnCode> => {
	/* 13 steps for slow validation (ref: validate in ar_node_utils.erl) */
	
	// validate_block:
	// height:
	// if( ! ar_block:verify_height ) return false
	// %% @doc Verify the height of the new block is the one higher than the
	// %% current height.
	// verify_height(NewB, OldB) ->
	// 	NewB#block.height == (OldB#block.height + 1).
	//// Easy to implement, circle back to this

	// previous_block:
	// if( ! ar_block:verify_previous_block(NewB, OldB) ) return false
	// %% @doc Verify that the previous_block hash of the new block is the indep_hash
	// %% of the current block.
	// verify_previous_block(NewB, OldB) ->
	// 	OldB#block.indep_hash == NewB#block.previous_block.
	//// Easy to implement, circle back to this

	// poa:
	// if(! ar_poa:validate(OldB#block.indep_hash, OldB#block.weave_size, BI, POA) ) return false

	
	// difficulty:
	// if(! ar_retarget:validate_difficulty(NewB, OldB) ) return false
	
	// pow:
	// POW = ar_weave:hash( ar_block:generate_block_data_segment(NewB), Nonce, Height );
	// if(! ar_mine:validate(POW, ar_poa:modify_diff(Diff, POA#poa.option), Height) ) return false
	// if(! ar_block:verify_dep_hash(NewB, POW) ) return false

	// independent_hash:
	// if( ar_weave:indep_hash_post_fork_2_0(NewB) != NewB#block.indep_hash ) return false
	let indepHash = await getIndepHash(block)
	if( ! Buffer.from(indepHash).equals(block.indep_hash) ){
		return {code: 400, message: "Invalid independent hash"}
	}

	// wallet_list:
	// get old block reward & height 
	// UpdatedWallets = update_wallets(NewB, Wallets, RewardPool, Height)
	// if(any wallets are invalid) return false

	// block_field_sizes:
	// if(! ar_block:block_field_size_limit(NewB) ) return false

	// txs:
	// if( ar_tx_replay_pool:verify_block_txs === invalid ) return false

	// tx_root:
	// ar_block:verify_tx_root(NewB) === false; return false

	// weave_size:
	// ar_block:verify_weave_size(NewB, OldB, TXs) === false; return false

	// block_index_root:
	// ar_block:verify_block_hash_list_merkle(NewB, OldB, BI) === false; return false

	// last_retarget:
	// ar_block:verify_last_retarget(NewB, OldB) === false; return false

	return {code:200, message:"Block slow check OK"}
}

const getIndepHash = async (block: Block): Promise<Uint8Array> => {
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

const generateBlockDataSegment = async (block: Block): Promise<Uint8Array> => {
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
		Arweave.utils.stringToBuffer(block.timestamp.toString()), 			// Number.toString() might need to check against Erlang's integer_to_binary for consistency
		Arweave.utils.stringToBuffer(block.last_retarget.toString()),
		Arweave.utils.stringToBuffer(block.diff.toString()),						// BigNumber.toString() as above
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

	// if(block.txs.length > 0 && typeof block.txs[0] === "string" ){
	// }

	return await deepHash([
		Arweave.utils.stringToBuffer(block.height.toString()),
		block.previous_block,
		block.tx_root,
		block.txs.map(txid=>Arweave.utils.b64UrlToBuffer(txid)),	
		Arweave.utils.stringToBuffer(block.block_size.toString()),
		Arweave.utils.stringToBuffer(block.weave_size.toString()),
		Arweave.utils.b64UrlToBuffer(block.reward_addr), 						// N.B. this should be set to "unclaimed" when we are mining
		block.tags.map((tag: Tag) => [
			Arweave.utils.stringToBuffer(tag.name), 									// Are these b64urls?
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