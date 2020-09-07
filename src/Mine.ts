import { FORK_HEIGHT_1_8, MIN_DIFF_FORK_1_8 } from './constants'
import { bufferToInt, bufferToBigInt } from './utils/buffer-utilities'


/* N.B. THIS FUNCTION HAS BEEN REPLACED BY CONSTANT MIN_DIFF_FORK_1_8 */
// export const mineMinDiff = (height: number) => {
// 	// return switchToLinearDiff(MIN_RANDOMX_DIFFICULTY)
// 	// return ( (2n ** 256n) - (2n ** (256n - MIN_RANDOMX_DIFFICULTY)) ) 
// 	return MIN_DIFF_FORK_1_8 
// }

//// Replaced by constant MAX_DIFF
// export const mineMaxDiff = () => {
// 	return 2n ** 256n
// }


export const validateMiningDifficulty = (bdsHash: Uint8Array, diff: bigint, height: number) => {

	if(height < FORK_HEIGHT_1_8){
		throw new Error("mineValidate not implemented for < FORK_HEIGHT_1_8")
	}
	
	return bufferToBigInt(bdsHash) > diff
}