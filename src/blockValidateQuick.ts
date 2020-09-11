import { ReturnCode, BlockDTO, } from  './types'
import { STORE_BLOCKS_AROUND_CURRENT, MIN_DIFF_FORK_1_8 } from './constants'
import { Block } from './Block'



export const validateBlockQuick = (block: Block, currentHeight: number):ReturnCode =>{

	/**
	 * The following 2 steps are taken from ar_http_iface_middleware:post_block
	 * Just 2 quick steps for initial validation - disregarding http bound steps.
	 * Idea is to return as fast as possible if block invalid
	 */

	// 1. check block height range is +/- STORE_BLOCKS_BEHIND_CURRENT from current
	if(block.height < (currentHeight - STORE_BLOCKS_AROUND_CURRENT)){
		return {code: 400, message: "Height is too far behind"}
	}
	if(block.height > (currentHeight + STORE_BLOCKS_AROUND_CURRENT)){
		return {code: 400, message: "Height is too far ahead"}
	}

	// 2. check_difficulty( BShadow#block.diff < ar_mine:min_difficulty(BShadow#block.height) )
	if( block.diff < MIN_DIFF_FORK_1_8 ){
		return {code: 400, message: "Difficulty too low"}
	}

	return {code: 200, message: "Block quick check OK"}
}

