import { BLOCKS_PER_YEAR, N_REPLICATIONS, USD_PER_GBY_2019, USD_PER_GBY_2018, USD_PER_GBY_DECAY_ANNUAL, FORK_HEIGHT_1_9, MAX_DIFF, INITIAL_USD_PER_AR_HEIGHT, WINSTON_PER_AR, ADD_ERLANG_ROUNDING_ERROR, INITIAL_USD_PER_AR_DIFF } from "./constants"
import { Decimal } from 'decimal.js'
import { retarget_switchToLinearDiff } from './Retarget'
import { bufferToBigInt } from "./utils/buffer-utilities"
import { calculateInflation } from "./utils/inflation"

export const txPerpetualStorage_usdToAr = (usd: Decimal, diff: bigint, height: number): bigint => {
	if(height < FORK_HEIGHT_1_9) throw new Error("txPerpetualStorageUsdToAr not impleneted for height < FORK_HEIGHT_1_9")
// usd_to_ar_post_fork_1_9(USD, Diff, Height) ->
// 	InitialDiff = ar_retarget:switch_to_linear_diff(?INITIAL_USD_PER_AR_DIFF(Height)()),
// 	MaxDiff = ar_mine:max_difficulty(),
// 	DeltaP = (MaxDiff - InitialDiff) / (MaxDiff - Diff),
// 	InitialInflation = ar_inflation:calculate(?INITIAL_USD_PER_AR_HEIGHT(Height)()),
// 	DeltaInflation = ar_inflation:calculate(Height) / InitialInflation,
// 	erlang:trunc(
// 		(USD * ?WINSTON_PER_AR * DeltaInflation) / (?INITIAL_USD_PER_AR(Height)() * DeltaP)
// 	).
// -endif.
	Decimal.config({precision: 50})
	let initialDiff = retarget_switchToLinearDiff( INITIAL_USD_PER_AR_DIFF )
	let deltaP = (MAX_DIFF - initialDiff) / (MAX_DIFF - diff)
	let initialInflation = calculateInflation(INITIAL_USD_PER_AR_HEIGHT) //a constant
	let deltaInflation = calculateInflation(height).dividedBy(initialInflation)

	let retNumerator = usd.mul(WINSTON_PER_AR).mul(deltaInflation)
	let retDenominator = new Decimal( (BigInt(INITIAL_USD_PER_AR_HEIGHT) * deltaP).toString() )
	let retValue = retNumerator.dividedBy(retDenominator)

	if(ADD_ERLANG_ROUNDING_ERROR){
		return BigInt( Math.floor(Number(retValue)) ) //this should only affect extra large valued txs?
	}
	return BigInt( retValue.floor() )  
}

export const txPerpetualStorage_getCostPerBlockAtTimestamp = (ts: bigint) => {
	/*
		%% @doc Cost to store 1GB per block at the given time.
		get_cost_per_block_at_timestamp(Timestamp) ->
			Datetime = system_time_to_universal_time(Timestamp, seconds),
			get_cost_per_block_at_datetime(Datetime).

		%% @doc $/GB-block, based on $/GB-year data.
		get_cost_per_block_at_datetime(DT) ->
		get_cost_per_year_at_datetime(DT) / ?BLOCKS_PER_YEAR.
	*/
	let dateTime = new Date(Number(ts)*1000) 
	return getCostPerYearAtDatetime(dateTime).div(BLOCKS_PER_YEAR)
}

// %% TODO Use calendar:system_time_to_universal_time/2 in Erlang OTP-21.
// system_time_to_universal_time(Time, TimeUnit) ->
// 	Seconds = erlang:convert_time_unit(Time, TimeUnit, seconds),
// 	DaysFrom0To1970 = 719528,
// 	SecondsPerDay = 86400,
// 	calendar:gregorian_seconds_to_datetime(Seconds + (DaysFrom0To1970 * SecondsPerDay)).




const getCostPerYearAtDatetime = (dateTime: Date) => {
// get_cost_per_year_at_datetime({{Y, M, _}, _} = DT) ->
// 	PrevY = prev_jun_30_year(Y, M),
// 	NextY = next_jun_30_year(Y, M),
// 	FracY = fraction_of_year(PrevY, NextY, DT),
// 	PrevYCost = usd_p_gby(PrevY),
// 	NextYCost = usd_p_gby(NextY),
// 	CY = PrevYCost - (FracY * (PrevYCost - NextYCost)),
// 	CY * ?N_REPLICATIONS.
	Decimal.config({precision: 100}) // not sure how precise this needs to be yet
	let year = dateTime.getUTCFullYear()
	let month = dateTime.getUTCMonth()
	let prevYear = prev_jun_30_year(year, month)
	let nextYear = next_jun_30_year(year, month)
	let fracYear: Decimal = fraction_of_year(prevYear, nextYear, dateTime)
	let prevYearCost: Decimal = usd_p_gby(prevYear)
	let nextYearCost: Decimal = usd_p_gby(nextYear)
	let cy = prevYearCost.minus( (prevYearCost.minus(nextYearCost)).mul(fracYear) )
	return cy.mul(N_REPLICATIONS)
}

// prev_jun_30_year(Y, M) when M < 7 ->
// 	Y - 1;
// prev_jun_30_year(Y, _M) ->
// 	Y.
const prev_jun_30_year = (y: number, m: number) => {
	if(m < 6) return y-1  // JS months are 0-11
	return y
}

// next_jun_30_year(Y, M) when M < 7 ->
// 	Y;
// next_jun_30_year(Y, _M) ->
// 	Y + 1.
const next_jun_30_year = (y: number, m: number) => {
	if(m < 6) return y  
	return y+1
}

// fraction_of_year(PrevY, NextY, {{Y, Mo, D},{H, Mi, S}}) ->
// 	Start = calendar:datetime_to_gregorian_seconds({{PrevY, 6, 30}, {23, 59, 59}}),
// 	Now = calendar:datetime_to_gregorian_seconds({{Y, Mo, D}, {H, Mi, S}}),
// 	End = calendar:datetime_to_gregorian_seconds({{NextY, 6, 30}, {23, 59, 59}}),
// 	(Now - Start) / (End - Start).
const fraction_of_year = (prevYear: number, nextYear: number, datetime: Date) => {
	Decimal.config({precision: 100}) // not sure how precise this needs to be yet
	let start = (new Date(prevYear, 5, 30, 23, 59, 59)).getTime()
	let end = new Date(nextYear, 5, 30, 23, 59, 59).getTime()
	let now = datetime.getTime()
	return new Decimal(now - start).dividedBy(end - start)
}

// %% @doc $/GB-year taken (or estimated) from empirical data.
// %% Assumes a year after 2019 inclusive. Uses data figures for 2018-2019.
// %% Uses exponential decay curve k*e^(-at) for future years.
// -spec usd_p_gby(nonegint()) -> usd().
// usd_p_gby(2018) -> ?USD_PER_GBY_2018;
// usd_p_gby(2019) -> ?USD_PER_GBY_2019;
// usd_p_gby(Y) ->
// 	K = ?USD_PER_GBY_2019,
// 	A = math:log(?USD_PER_GBY_DECAY_ANNUAL),
// 	T = Y - 2019,
// 	K * math:exp(A * T).
const usd_p_gby = (y: number) => {
	Decimal.config({precision: 100}) // not sure how precise this needs to be yet
	if(y === 2018) return new Decimal(USD_PER_GBY_2018)
	if(y === 2019) return new Decimal(USD_PER_GBY_2019)
	let k = new Decimal(USD_PER_GBY_2019)
	let a = Decimal.ln(USD_PER_GBY_DECAY_ANNUAL)
	let t = y - 2019
	return k.mul( Decimal.exp( a.mul(t) ) )
}