import { FORK_HEIGHT_1_7, FORK_HEIGHT_1_8 } from './constants'
import { switchToLinearDiff } from './Retarget'
import Arweave from 'arweave'

/*
	-ifdef(DEBUG).
	min_randomx_difficulty() -> 1.
	-else.
	min_randomx_difficulty() -> min_sha384_difficulty() + ?RANDOMX_DIFF_ADJUSTMENT.
	min_sha384_difficulty() -> 31.
*/
// The adjustment of difficutly going from SHA-384 to RandomX
const RANDOMX_DIFF_ADJUSTMENT = -14
const MIN_SHA384_DIFFICULTY = 31
const MIN_RANDOMX_DIFFICULTY = MIN_SHA384_DIFFICULTY + RANDOMX_DIFF_ADJUSTMENT

export const mineMinDiff = (height: number) => {
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
	let minDiff: number
	if(height >= FORK_HEIGHT_1_7){
		minDiff = MIN_RANDOMX_DIFFICULTY
	}else{
		minDiff = MIN_SHA384_DIFFICULTY
	}
	if(height >= FORK_HEIGHT_1_8){
		minDiff = switchToLinearDiff(minDiff)
	}
	return minDiff
}

export const mineMaxDiff = () => {
	return 2 ** 256
}



/**
 * Below depends on being supplied a BDS & the RandomX library.
 * Will follow this up this later
 */

// const mineValidate = (bds: Uint8Array, nonce: Uint8Array, diffString: string, height: number) => {
// 	/*
// 		%% @doc Validate that a given hash/nonce satisfy the difficulty requirement.
// 		validate(BDS, Nonce, Diff, Height) ->
// 			BDSHash = ar_weave:hash(BDS, Nonce, Height),
// 			case validate(BDSHash, Diff, Height) of
// 				true ->
// 					{valid, BDSHash};
// 				false ->
// 					{invalid, BDSHash}
// 			end.
// 	*/
// 	let bdsHash = weaveHash(bds, nonce, height)

// }

// const weaveHash = (bds: Uint8Array, nonce: Uint8Array, height: number) => {
// 	/*
// 		%% @doc Create the hash of the next block in the list, given a previous block,
// 		%% and the TXs and the nonce.
// 		hash(BDS, Nonce, Height) ->
// 			HashData = << Nonce/binary, BDS/binary >>,
// 			case Height >= ar_fork:height_1_7() of
// 				true ->
// 					ar_randomx_state:hash(Height, HashData);
// 				false ->
// 					crypto:hash(?MINING_HASH_ALG, HashData)
// 			end.
// 	*/
// 	let hashData = Arweave.utils.concatBuffers([nonce, bds])
// 	if(height >= FORK_HEIGHT_1_7){
// 		return randomxStateHash(height, hashData)
// 	}
// 	return Arweave.crypto.hash(hashData, MINING_HASH_ALG)	
// }

// const randomxStateHash = () => {

// }

// const mineValidate = (bdsHash: Uint8Array, diffString: string, height: number) => {
// 	/*
// 		%% @doc Validate that a given block data segment hash satisfies the difficulty requirement.
// 		validate(BDSHash, Diff, Height) ->
// 			case ar_fork:height_1_8() of
// 				H when Height >= H ->
// 					binary:decode_unsigned(BDSHash, big) > Diff;
// 				_ ->
// 					case BDSHash of
// 						<< 0:Diff, _/bitstring >> ->
// 							true;
// 						_ ->
// 							false
// 					end
// 			end.
// 	 */
// 	if(height >= FORK_HEIGHT_1_8){
// 		let diff: bigint = BigInt(diffString)
// 		let bdsBigint: bigint = bufferToBigInt(bdsHash)
// 		return bdsBigint > diff
// 	}
	
// 	let comparator = bdsHash.slice(0, diff)

// }