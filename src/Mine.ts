import { FORK_HEIGHT_1_7, FORK_HEIGHT_1_8 } from './constants'
import { switchToLinearDiff } from './Retarget'
import Arweave from 'arweave'
import { bufferToInt } from './utils/buffer-utilities'

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


export const mineValidate = (bdsHash: Uint8Array, diff: number, height: number) => {
	/*
		%% @doc Validate that a given block data segment hash satisfies the difficulty requirement.
		validate(BDSHash, Diff, Height) ->
			case ar_fork:height_1_8() of
				H when Height >= H ->
					binary:decode_unsigned(BDSHash, big) > Diff;
				_ ->
					case BDSHash of
						<< 0:Diff, _/bitstring >> ->
							true;
						_ ->
							false
					end
			end.
	 */
	if(height < FORK_HEIGHT_1_8){
		throw new Error("mineValidate not implemented for < FORK_HEIGHT_1_8")
	}
	return bufferToInt(bdsHash) > diff
}