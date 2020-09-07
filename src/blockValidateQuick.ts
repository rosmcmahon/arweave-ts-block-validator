import { ReturnCode, BlockDTO, } from  './types'
import { STORE_BLOCKS_AROUND_CURRENT, MIN_DIFF_FORK_1_8 } from './constants'
import { Block } from './Block'



export const validateBlockJson = async (blockJson: BlockDTO) => {
	let block: Block
	try {
		block = await Block.createFromDTO(blockJson)
	} catch (error) {
		console.log('error',error)
		return false
	}
	return true
}

export const validateBlockQuick = (blockJson: BlockDTO, block: Block, currentHeight: number):ReturnCode =>{

	if( ! validateBlockJson(blockJson) ){
		return {code: 400, message: "Invalid blockJson."}
	}

	/* 2 steps for quick, initial validation (disregarding http bound steps). Return as fast as possible */

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
