import { ReturnCode, BlockDTO, Tag, BlockIndexTuple, Poa } from  './types'
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

