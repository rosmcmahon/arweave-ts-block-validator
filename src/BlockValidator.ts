import { ReturnCode, BlockDTO } from  './types'
import { STORE_BLOCKS_AROUND_CURRENT, FORK_HEIGHT_1_7, FORK_HEIGHT_1_8 } from './constants'
import { Block } from './Block'
import { BigNumber } from 'bignumber.js'

export const validateBlockJson = (blockJson: BlockDTO, height: number): ReturnCode => {
	let block: Block
	try {
		block = new Block(blockJson)
	} catch (error) {
		console.log('error',error)
		return {code: 400, message: "Invalid block."}
	}
	return validateBlock(block, height)
}

export const validateBlock = (block: Block, currentHeight: number):ReturnCode =>{

	/* 4 steps for quick, initial validation. Return as fast as possible */

	// check block height range is +/- STORE_BLOCKS_BEHIND_CURRENT from current
	if(block.height < currentHeight-STORE_BLOCKS_AROUND_CURRENT) return {code: 400, message: "Height is too far behind"}
	if(block.height > currentHeight+STORE_BLOCKS_AROUND_CURRENT) return {code: 400, message: "Height is too far ahead"}

	/*** This is the most important part (???) ***/
	//check_difficulty
	//check_difficulty( BShadow#block.diff < ar_mine:min_difficulty(BShadow#block.height) )
	if( block.diff.isLessThan(minDiff(block.height)) ) return {code: 400, message: "Difficulty too low"}

	

	
	


	return {code:200,message:"Block OK"}
}

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
const minDiff = (height: number): BigNumber => {
	if(process.env.NODE_ENV !== "production"){
		return new BigNumber(1)
	} else {
		let diff: BigNumber
		if(height >= FORK_HEIGHT_1_7){
			diff = new BigNumber(MIN_RANDOMX_DIFFICULTY)
		}else{
			diff = new BigNumber(MIN_SHA384_DIFFICULTY)
		}
		if(height >= FORK_HEIGHT_1_8){
			diff = switch_to_linear_diff(diff)
		}
		return diff
	}
}

/*
-ifdef(DEBUG).
min_randomx_difficulty() -> 1.
-else.
min_randomx_difficulty() -> min_sha384_difficulty() + ?RANDOMX_DIFF_ADJUSTMENT.
min_sha384_difficulty() -> 31.
randomx_genesis_difficulty() -> ?DEFAULT_DIFF.
-endif.
*/
// The adjustment of difficutly going from SHA-384 to RandomX.
const RANDOMX_DIFF_ADJUSTMENT = -14
const MIN_SHA384_DIFFICULTY = 31
const MIN_RANDOMX_DIFFICULTY = MIN_SHA384_DIFFICULTY + RANDOMX_DIFF_ADJUSTMENT
/*
%% @doc The number a hash must be greater than, to give the same odds of success
%% as the old-style Diff (number of leading zeros in the bitstring).
switch_to_linear_diff(Diff) ->
	erlang:trunc(math:pow(2, 256)) - erlang:trunc(math:pow(2, 256 - Diff)).
*/
const switch_to_linear_diff = (diff: BigNumber) => {
	// return Math.trunc( Math.pow(2, 256) ) - Math.trunc( Math.pow(2, (256 - diff)) )
	let a: BigNumber = (new BigNumber(2)).pow(256).integerValue(BigNumber.ROUND_DOWN)
	let power: BigNumber = (new BigNumber(256)).minus(diff)
	let b: BigNumber = (new BigNumber(2)).pow(power).integerValue(BigNumber.ROUND_DOWN)
	
	return  a.minus(b)
}