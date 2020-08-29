import { FORK_HEIGHT_1_8, MIN_DIFF_FORK_1_8 } from './constants'
import { bufferToInt } from './utils/buffer-utilities'


/* N.B. THIS FUNCTION HAS BEEN REPLACED BY CONSTANT MIN_DIFF_FORK_1_8 */
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
	if(height < FORK_HEIGHT_1_8){
		throw new Error("mineMinDiff Block height unsupported")
	}
	// return switchToLinearDiff(MIN_RANDOMX_DIFFICULTY)
	// return ( (2n ** 256n) - (2n ** (256n - MIN_RANDOMX_DIFFICULTY)) ) 
	return MIN_DIFF_FORK_1_8 
}

//// Replaced by constant MAX_DIFF
// export const mineMaxDiff = () => {
// 	return 2n ** 256n
// }


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