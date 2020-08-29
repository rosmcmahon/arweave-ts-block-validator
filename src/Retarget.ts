import { RETARGET_BLOCKS, FORK_HEIGHT_1_8, FORK_HEIGHT_1_9, DIFF_ADJUSTMENT_DOWN_LIMIT, DIFF_ADJUSTMENT_UP_COMPARATOR, DIFF_ADJUSTMENT_DOWN_COMPARATOR, RETARGET_BLOCK_TIME, NEW_RETARGET_TOLERANCE, MAX_DIFF, MIN_DIFF_FORK_1_8 } from './constants'
import { Block } from './Block'



export const switchToLinearDiff = (diff: bigint) => {
	/*
		%% @doc The number a hash must be greater than, to give the same odds of success
		%% as the old-style Diff (number of leading zeros in the bitstring).
		switch_to_linear_diff(Diff) ->
			erlang:trunc(math:pow(2, 256)) - erlang:trunc(math:pow(2, 256 - Diff)).
	*/
	return ( (2n ** 256n) - (2n ** (256n - diff)) ) 
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
	if( ((BigInt(block.height) % RETARGET_BLOCKS) === 0n) && (block.height !== 0) ){
		let calculated = retargetCalculateDifficulty(
			prevBlock.diff,
			block.timestamp,
			prevBlock.last_retarget,
			block.height,
		)
		if(block.diff !== calculated){
			console.debug('block.diff', block.diff)
			console.debug('calculated', calculated)
		}
		return block.diff === calculated
	}
	return (block.diff===prevBlock.diff) && (block.last_retarget===prevBlock.last_retarget)
}

const retargetCalculateDifficulty = (oldDiff: bigint, ts: bigint, last: bigint, height: number) => {
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
	if(height <= FORK_HEIGHT_1_8){
		throw new Error('retargetCalculateDifficulty for height <= FORK_HEIGHT_1_8 not implemented')
	}
	return calculateDifficultyLinear(oldDiff, ts, last, height)
}


const calculateDifficultyLinear = (oldDiff: bigint, ts: bigint, last: bigint, height: number): bigint => {
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
	/**
	 * Looking at the above calculations, especially:
	 * a) RETARGET_TOLERANCE_FLOAT = 0.1, and 
	 * b) the multiplication of a very small float against a very large int here
	 * DiffInverse = erlang:trunc((MaxDiff - OldDiff) * EffectiveTimeDelta)
	 * The algebra can be chaged to avoid these types and mathematics as follows..
	 * 
	 * abs(1 - TimeDelta) < ?RETARGET_TOLERANCE
	 * , where TimeDelta = ActualTime/(RETARGET_BLOCKS * TARGET_TIME),
	 * RETARGET_TOLERANCE = 0.1,
	 * and RETARGET_BLOCK_TIME = 120 * 10 = 1200.
	 * substituting:
	 * TimeDelta becomes = ActualTime / RETARGET_BLOCKS * TARGET_TIME = actualTime / RETARGET_BLOCK_TIME
	 * ar_mine:max_difficulty becomes a bigint const 2^256 = MAX_DIFF (see constants.ts for all new constants)
	 * MIN_DIFF_FORK_1_8 is a constant above FORK_HEIGHT_1_8 = MIN_DIFF_FORK_1_8
	 * 
	 * We will also inline the first "between(num, min, max)" clamp function to avoid culmulative calculations 
	 * and rounding errors associated
	 * 
	 * (Level 1 etd) (Level 2 diffInverse)
	 *                       
	 *              / between2
	 *             /        
	 * between ------ between2 
	 *             \        
	 *              \ between2 
	 *                      
	 * Further algebra will be explained in the comments below
	 */

	debugger;
	// let targetTime = RETARGET_BLOCK_TIME = RETARGET_BLOCKS * TARGET_TIME //1200n replaced by 1 constant
	let actualTime = ts - last
	//let timeDelta  = actualTime / RETARGET_BLOCK_TIME // avoid this early division operation

	// | 1 - (actualTime/RETARGET_BLOCK_TIME) | < RETARGET_TOLERANCE, becomes
	// | RETARGET_BLOCK_TIME - actualTime | < RETARGET_BLOCK_TIME * RETARGET_TOLERANCE, becomes
	// | newExpr | < RETARGET_BLOCK_TIME * RETARGET_TOLERANCE
	let newExpr = (RETARGET_BLOCK_TIME - actualTime) //integer operation
	if(newExpr < 0){
		newExpr = -newExpr // get the absolute value
	}
	if( newExpr < NEW_RETARGET_TOLERANCE ){
		return oldDiff
	}

	//let maxDiff: bigint = mineMaxDiff() //2^256, just use MAX_DIFF
	// let minDiff: bigint = mineMinDiff(height) //use MIN_DIFF_FORK_1_8
	// let effectiveTimeDelta = betweenNums( timeDelta, (1/DIFF_ADJUSTMENT_UP_LIMIT), DIFF_ADJUSTMENT_DOWN_LIMIT )
	// ** N.B. renaming effectiveTimeDelta => etd **
	// inlining betweenNums function, and substituting:
	// etd = timeDelta = actualTime / RETARGET_BLOCK_TIME
	let maxLessOldDiff = MAX_DIFF - oldDiff
	let diffInverse: bigint
	const between2 = (diff: bigint) => {
		if(diff < MIN_DIFF_FORK_1_8){
			return MIN_DIFF_FORK_1_8
		}
		if(diff > MAX_DIFF){
			return MAX_DIFF
		}
		return diff
	}
	
	//// between level 1, minimum branch:
	// if( actualTime/RETARGET_BLOCK_TIME < (1/DIFF_ADJUSTMENT_UP_LIMIT) ) becomes
	// if( actualTime < (RETARGET_BLOCK_TIME/DIFF_ADJUSTMENT_UP_LIMIT) ) precalculated becomes
	if( actualTime < DIFF_ADJUSTMENT_UP_COMPARATOR){
		// means etd = 1/DIFF_ADJUSTMENT_UP_LIMIT
		// diffInverse = Math.floor((maxDiff - oldDiff) * etd)
		// substituting:
		// diffInverse = Math.floor( (maxLessOldDiff) * (1/DIFF_ADJUSTMENT_UP_LIMIT) ) becomes
		// diffInverse = Math.floor( (maxLessOldDiff / DIFF_ADJUSTMENT_UP_LIMIT) )
		// in this particular case DIFF_ADJUSTMENT_UP_LIMIT = 4, we can avoid / operator by bitshifting

		diffInverse = (maxLessOldDiff >> 2n) //binary division by 4 as DIFF_ADJUSTMENT_UP_LIMIT = 4
		return between2(diffInverse)
	}
	
	//// between level 1, maximum branch:
	// if ( (actualTime/RETARGET_BLOCK_TIME) < DIFF_ADJUSTMENT_DOWN_LIMIT ) becomes
	// if ( actualTime < (RETARGET_BLOCK_TIME * DIFF_ADJUSTMENT_DOWN_LIMIT) ) becomes
	if(actualTime > DIFF_ADJUSTMENT_DOWN_COMPARATOR){
		// mean etd = 2 // DIFF_ADJUSTMENT_DOWN_LIMIT
		// diffInverse = Math.floor((maxDiff - oldDiff) * etd)

		diffInverse = (maxLessOldDiff * DIFF_ADJUSTMENT_DOWN_LIMIT)
		return between2(diffInverse)
	}
	// between level 1, etd is in-beween min/max
	// means etd = actualTime / RETARGET_BLOCK_TIME
	// diffInverse = Math.floor((maxDiff - oldDiff) * etd), substituting gives
	// diffInverse = Math.floor((maxDiff - oldDiff) * actualTime / RETARGET_BLOCK_TIME), rearranging gives
	// diffInverse = Math.floor( ((maxDiff - oldDiff)/RETARGET_BLOCK_TIME) * actualTime ) 
	// this is better as bigint division better than introducing floats
	diffInverse = (maxLessOldDiff/RETARGET_BLOCK_TIME) * actualTime
	return between2(diffInverse)
}