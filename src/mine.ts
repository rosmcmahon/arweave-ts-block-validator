import { FORK_HEIGHT_1_8, MIN_DIFF_FORK_1_8 } from './constants'
import { bufferToInt, bufferToBigInt } from './utils/buffer-utilities'


/* N.B. mine_minDiff(height) && mine_maxDiff() have both been replaced by constants */


export const validateMiningDifficulty = (bdsHash: Uint8Array, diff: bigint, height: number) => {

	if(height < FORK_HEIGHT_1_8){
		throw new Error("validateMiningDifficulty not implemented for < FORK_HEIGHT_1_8")
	}
	
	return bufferToBigInt(bdsHash) > diff
}