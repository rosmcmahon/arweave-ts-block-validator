import { RETARGET_BLOCKS, FORK_HEIGHT_1_7, FORK_HEIGHT_1_8, TARGET_TIME, RETARGET_TOLERANCE_FLOAT, FORK_HEIGHT_1_9, DIFF_ADJUSTMENT_UP_LIMIT, DIFF_ADJUSTMENT_DOWN_LIMIT } from './constants'
import { Block } from './Block'
import { mineMinDiff, mineMaxDiff } from './Mine'


export const switchToLinearDiff = (diff: number) => {
	/*
		%% @doc The number a hash must be greater than, to give the same odds of success
		%% as the old-style Diff (number of leading zeros in the bitstring).
		switch_to_linear_diff(Diff) ->
			erlang:trunc(math:pow(2, 256)) - erlang:trunc(math:pow(2, 256 - Diff)).
	*/
	return Math.floor( (2 ** 256) - (2 ** (256 - diff)) ) 
	// bigints would be more precise, but erlang uses IEEE 754
}

export const retargetValidateDiff = (block: Block, prevBlock: Block) => {
	/*
		%% @doc Validate that a new block has an appropriate difficulty.
		validate_difficulty(NewB, OldB) when ?IS_RETARGET_BLOCK(NewB) ->
			(NewB#block.diff ==
				calculate_difficulty(
					OldB#block.diff,
					NewB#block.timestamp,
					OldB#block.last_retarget,
					NewB#block.height)
			);
		validate_difficulty(NewB, OldB) ->
			(NewB#block.diff == OldB#block.diff) and
				(NewB#block.last_retarget == OldB#block.last_retarget).
	*/
	/*
		-define(IS_RETARGET_BLOCK(X),
			(
				((X#block.height rem ?RETARGET_BLOCKS) == 0) and
				(X#block.height =/= 0)
			)
		).
	*/
	debugger;
	if( (block.height % RETARGET_BLOCKS === 0) && (block.height !== 0) ){
		let calculated = retargetCalculateDifficulty(
			prevBlock.diff,
			block.timestamp,
			prevBlock.last_retarget,
			block.height,
		)
		return block.diff === calculated
	}
	return (block.diff===prevBlock.diff) && (block.last_retarget===prevBlock.last_retarget)
}

const retargetCalculateDifficulty = (oldDiff: number, ts: number, last: number, height: number) => {
	/*
		%% @doc Calculate a new difficulty, given an old difficulty and the period
		%% since the last retarget occcurred.
		-ifdef(FIXED_DIFF).
		calculate_difficulty(_OldDiff, _TS, _Last, _Height) ->
			?FIXED_DIFF.
		-else.
		calculate_difficulty(OldDiff, TS, Last, Height) ->
			case {ar_fork:height_1_7(), ar_fork:height_1_8()} of
				{Height, _} ->
					switch_to_randomx_fork_diff(OldDiff);
				{_, Height} ->
					switch_to_linear_diff(OldDiff);
				{_, H} when Height > H ->
					calculate_difficulty_linear(OldDiff, TS, Last, Height);
				_ ->
					calculate_difficulty1(OldDiff, TS, Last, Height)
			end.

		calculate_difficulty1(OldDiff, TS, Last, Height) ->
			TargetTime = ?RETARGET_BLOCKS * ?TARGET_TIME,
			ActualTime = TS - Last,
			TimeError = abs(ActualTime - TargetTime),
			Diff = erlang:max(
				if
					TimeError < (TargetTime * ?RETARGET_TOLERANCE) -> OldDiff;
					TargetTime > ActualTime                        -> OldDiff + 1;
					true                                           -> OldDiff - 1
				end,
				ar_mine:min_difficulty(Height)
			),
			Diff.
	*/
	// should we care about FIXED_DIFF ?
	if(height <= FORK_HEIGHT_1_8){
		throw new Error('retargetCalculateDifficulty for height <= FORK_HEIGHT_1_8 not implemented')
	}
	return calculateDifficultyLinear(oldDiff, ts, last, height)
}


const calculateDifficultyLinear = (oldDiff: number, ts: number, last: number, height: number) => {
	/*
		calculate_difficulty_linear(OldDiff, TS, Last, Height) ->
		case Height >= ar_fork:height_1_9() of
			false ->
				calculate_difficulty_legacy(OldDiff, TS, Last, Height);
			true ->
				calculate_difficulty_linear2(OldDiff, TS, Last, Height)
		end.
	*/
	if(height < FORK_HEIGHT_1_9){
		throw new Error("ar_retarget:calculate_difficulty_legacy not implemented")
	}
	/*
		calculate_difficulty_linear2(OldDiff, TS, Last, Height) ->
			TargetTime = ?RETARGET_BLOCKS * ?TARGET_TIME,
			ActualTime = TS - Last,
			TimeDelta = ActualTime / TargetTime,
			case abs(1 - TimeDelta) < ?RETARGET_TOLERANCE of
				true ->
					OldDiff;
				false ->
					MaxDiff = ar_mine:max_difficulty(),
					MinDiff = ar_mine:min_difficulty(Height),
					EffectiveTimeDelta = between(
						ActualTime / TargetTime,
						1 / ?DIFF_ADJUSTMENT_UP_LIMIT,
						?DIFF_ADJUSTMENT_DOWN_LIMIT
					),
					DiffInverse = erlang:trunc((MaxDiff - OldDiff) * EffectiveTimeDelta),
					between(
						MaxDiff - DiffInverse,
						MinDiff,
						MaxDiff
					)
			end.
	*/
	let targetTime: number = RETARGET_BLOCKS * TARGET_TIME //1200n
	let actualTime: number = ts - last
	let timeDelta = actualTime / targetTime // ~120
	if( Math.abs(1-timeDelta) < RETARGET_TOLERANCE_FLOAT ){
		return oldDiff
	}
	let maxDiff: number = Number( mineMaxDiff() ) //2^256
	let minDiff: number = Number( mineMinDiff(height) ) //similar size
	let effectiveTimeDelta: number = betweenNums( // 0.25 <= effectiveTimeDelta <= 2
		actualTime / targetTime,
		1 / DIFF_ADJUSTMENT_UP_LIMIT,
		DIFF_ADJUSTMENT_DOWN_LIMIT
	)

	let diffInverse = (maxDiff - oldDiff) * effectiveTimeDelta //big integer * small float. accuracy issue

	return betweenNums(
		maxDiff - diffInverse,
		minDiff,
		maxDiff
	)
}

const betweenNums = (num: number, min: number, max: number) =>{
	if(num < min) return min 
	if(num > max) return max
	return num
}
