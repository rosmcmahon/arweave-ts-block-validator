import { RETARGET_BLOCKS, FORK_HEIGHT_1_8, FORK_HEIGHT_1_9, DIFF_ADJUSTMENT_DOWN_LIMIT, DIFF_ADJUSTMENT_UP_LIMIT, DIFF_ADJUSTMENT_UP_COMPARATOR, DIFF_ADJUSTMENT_DOWN_COMPARATOR, RETARGET_BLOCK_TIME, TARGET_TIME, RETARGET_TOLERANCE_FLOAT, NEW_RETARGET_TOLERANCE, MAX_DIFF, MIN_DIFF_FORK_1_8, ADD_ERLANG_ROUNDING_ERROR } from './constants'
import { Block } from './Block'
import { Decimal } from 'decimal.js'



export const retargetSwitchToLinearDiff = (diff: bigint) => {
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
	if( (block.height % Number(RETARGET_BLOCKS) === 0) && (block.height !== 0) ){
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
		/**
		 * There is still a rounding error in the incoming block.diff, so at worst (the limit
		 * at Diff approaches MAX_DIFF) only first 53 significant bits are accurate in the 
		 * block.diff. In order to account for this rounding error we round the block.diff and
		 * calculated diff to JS Numbers. This will be fixed in a later fork.
		 */
		if(ADD_ERLANG_ROUNDING_ERROR){
			return Number(block.diff) === Number(calculated)
		}
		return block.diff === calculated //retargetCalculateDifficulty may need to be adjusted depending on upcoming fork
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

const calculateDifficultyLinearALGEBRA = (oldDiff: bigint, ts: bigint, last: bigint, height: number): bigint => {
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
	 * and RETARGET_BLOCK_TIME = RETARGET_BLOCKS * TARGET_TIME = 120 * 10 = 1200
	 * substituting:
	 * TimeDelta becomes = ActualTime / RETARGET_BLOCKS * TARGET_TIME = actualTime / RETARGET_BLOCK_TIME
	 * ar_mine:max_difficulty becomes a bigint const 2^256 = MAX_DIFF (see constants.ts for all new constants)
	 * MIN_DIFF_FORK_1_8 is a constant above FORK_HEIGHT_1_8 = MIN_DIFF_FORK_1_8
	 * erlang:trunc is done automatically when we are using bigints as integer division is performed
	 * 
	 * We will also inline the "between(num, min, max)" clamp functions to give a tree of 
	 * "between" clamp functions which avoids culmulative calculations and rounding errors associated
	 * 
	 * (Level 1 etd) (Level 2 diffInverse)
	 *                       / return
	 *             / between - return
	 *            /          \ return
	 *          /        / return
	 * between - beween - return
	 *          \        \ return
	 *           \          / return
	 *            \ between - return
	 *                      \ return
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
	let diffInverse: bigint
	const between2 = (maxLessDiffInverse: bigint) => {
		if(maxLessDiffInverse < MIN_DIFF_FORK_1_8){
			return MIN_DIFF_FORK_1_8
		}
		if(maxLessDiffInverse > MAX_DIFF){
			return MAX_DIFF
		}
		return maxLessDiffInverse
	}
	
	//// between level 1, minimum branch:
	// if( actualTime/RETARGET_BLOCK_TIME < (1/DIFF_ADJUSTMENT_UP_LIMIT) ) becomes
	// if( actualTime < (RETARGET_BLOCK_TIME/DIFF_ADJUSTMENT_UP_LIMIT) ) precalculated becomes
	if( actualTime < DIFF_ADJUSTMENT_UP_COMPARATOR){
		// means etd = 1/DIFF_ADJUSTMENT_UP_LIMIT = 1 / 4
		// in this particular case DIFF_ADJUSTMENT_UP_LIMIT = 4, we can avoid div operator by bitshifting
		// diffInverse = (maxDiff - oldDiff) * etd)
		// substituting:
		// (MaxDiff - DiffInverse) = MAX_DIFF - ( (MAX_DIFF - oldDiff) * (1/4) ) becomes
		// (MaxDiff - DiffInverse) = MAX_DIFF - ( (MAX_DIFF - oldDiff) / 4 ) becomes
		// (MaxDiff - DiffInverse) = { (4 * MAX_DIFF) - (MAX_DIFF - oldDiff) } / 4  becomes
		// (MaxDiff - DiffInverse) = { (3 * MAX_DIFF) + oldDiff) } / 4  
		let maxLessDiffInverse = ( (3n * MAX_DIFF) + oldDiff ) >> 2n

		return between2(maxLessDiffInverse)
	}
	
	//// between level 1, maximum branch:
	// if ( (actualTime/RETARGET_BLOCK_TIME) < DIFF_ADJUSTMENT_DOWN_LIMIT ) becomes
	// if ( actualTime < (RETARGET_BLOCK_TIME * DIFF_ADJUSTMENT_DOWN_LIMIT) ) becomes
	if(actualTime > DIFF_ADJUSTMENT_DOWN_COMPARATOR){
		// mean etd = 2 // <- DIFF_ADJUSTMENT_DOWN_LIMIT
		// diffInverse = Math.floor((maxDiff - oldDiff) * etd) 
		// substituting:
		// diffInverse = ((maxDiff - oldDiff) * 2) 
		// MaxDiff - DiffInverse = MAX_DIFF - ((MAX_DIFF - oldDiff) * 2)
		// MaxDiff - DiffInverse = MAX_DIFF - (2*MAX_DIFF) + (2*oldDiff) 
		// MaxDiff - DiffInverse = (2*oldDiff) - MAX_DIFF
		let maxLessDiffInverse = 2n * oldDiff - MAX_DIFF
		return between2(maxLessDiffInverse)
	}
	// between level 1, etd is in-beween min/max
	// means etd = actualTime / RETARGET_BLOCK_TIME
	// diffInverse = Math.floor((maxDiff - oldDiff) * etd), substituting gives
	// diffInverse = Math.floor((maxDiff - oldDiff) * actualTime / RETARGET_BLOCK_TIME), rearranging gives
	// MaxDiff - DiffInverse = MAX_DIFF - ((maxDiff - oldDiff) * actualTime / RETARGET_BLOCK_TIME)
	//  = { RETARGET_BLOCK_TIME*MAX_DIFF - (MAX_DIFF - oldDiff) * actualTime } / RETARGET_BLOCK_TIME
	//  = { RETARGET_BLOCK_TIME*MAX_DIFF - (actualTime*MAX_DIFF + actualTime* oldDiff)  } / RETARGET_BLOCK_TIME
	//  = { (RETARGET_BLOCK_TIME - actualTime)*MAX_DIFF + actualTime * oldDiff)  } / RETARGET_BLOCK_TIME
	let maxLessDiffInverse = (  (RETARGET_BLOCK_TIME - actualTime)*MAX_DIFF + actualTime*oldDiff  ) / RETARGET_BLOCK_TIME
	// where RETARGET_BLOCK_TIME and actualTime are small integers
	return between2(maxLessDiffInverse)
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
	Decimal.config({ precision: 50 }) // no point overdoing it, get rounded to Number in the end
	let targetTime = new Decimal(RETARGET_BLOCKS * TARGET_TIME) //1200n
	let actualTime = new Decimal( (ts - last).toString() )
	let timeDelta = actualTime.dividedBy(targetTime)
	let oneMinusTimeDelta = new Decimal(1).minus(timeDelta)

	if(ADD_ERLANG_ROUNDING_ERROR && Number(oneMinusTimeDelta) < RETARGET_TOLERANCE_FLOAT ){
		return oldDiff
	} else if( oneMinusTimeDelta.abs().lessThan(RETARGET_TOLERANCE_FLOAT) ){
		return oldDiff
	}

	let effectiveTimeDelta: Decimal = betweenDecimals( // 0.25 <= effectiveTimeDelta <= 2
		timeDelta,
		new Decimal(1).dividedBy(DIFF_ADJUSTMENT_UP_LIMIT),
		new Decimal(DIFF_ADJUSTMENT_DOWN_LIMIT)
	)

	let diffInverse: Decimal = new Decimal((MAX_DIFF - oldDiff).toString()).mul(effectiveTimeDelta)

	let diffInverseInt: bigint
	if(ADD_ERLANG_ROUNDING_ERROR){
		diffInverseInt = BigInt( Number(diffInverse) )
	} else{
		diffInverseInt = BigInt(diffInverse)
	}

	let returnValue = betweenBigInts(
		MAX_DIFF - diffInverseInt,
		MIN_DIFF_FORK_1_8,
		MAX_DIFF
	)
		
	return returnValue
}

const betweenBigInts = (num: bigint, min: bigint, max: bigint) =>{
	if(num < min) return min 
	if(num > max) return max
	return num
}
const betweenDecimals = (num: Decimal, min: Decimal, max: Decimal) =>{
	if(num.lessThan(min)) return min 
	if(num.greaterThan(max)) return max
	return num
}