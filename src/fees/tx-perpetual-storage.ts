import { BLOCKS_PER_YEAR, N_REPLICATIONS, USD_PER_GBY_2019, USD_PER_GBY_2018, USD_PER_GBY_DECAY_ANNUAL, FORK_HEIGHT_1_9, MAX_DIFF, INITIAL_USD_PER_AR_HEIGHT, WINSTON_PER_AR, ADD_ERLANG_ROUNDING_ERROR, INITIAL_USD_PER_AR_DIFF, TX_SIZE_BASE, MINING_REWARD_DIVIDER, MINING_REWARD_MULTIPLIER, INITIAL_USD_PER_AR } from "../constants"
// import { Decimal } from 'decimal.js'
import { switchToLinearDiff } from '../hashing/difficulty-retarget'
import { calculateInflation } from "./inflation"

export const txPerpetualStorage_usdToAr = (usd: number, diff: bigint, height: number) => {
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

	let initialDiff = switchToLinearDiff( INITIAL_USD_PER_AR_DIFF )
	let deltaP = Number( MAX_DIFF - initialDiff ) / Number(MAX_DIFF - diff)
	let initialInflation = calculateInflation(INITIAL_USD_PER_AR_HEIGHT)
	let deltaInflation = calculateInflation(height) / initialInflation

	return Math.floor(
		(usd * WINSTON_PER_AR * deltaInflation) / (INITIAL_USD_PER_AR * deltaP)
	)
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
	return getCostPerYearAtDatetime(dateTime) / (BLOCKS_PER_YEAR)
}

const getCostPerYearAtDatetime = (dateTime: Date) => {
// get_cost_per_year_at_datetime({{Y, M, _}, _} = DT) ->
// 	PrevY = prev_jun_30_year(Y, M),
// 	NextY = next_jun_30_year(Y, M),
// 	FracY = fraction_of_year(PrevY, NextY, DT),
// 	PrevYCost = usd_p_gby(PrevY),
// 	NextYCost = usd_p_gby(NextY),
// 	CY = PrevYCost - (FracY * (PrevYCost - NextYCost)),
// 	CY * ?N_REPLICATIONS.

	// Decimal.config({precision: 100}) // not sure how precise this needs to be yet

	let year = dateTime.getUTCFullYear()
	let month = dateTime.getUTCMonth()
	let prevYear = prev_jun_30_year(year, month)
	let nextYear = next_jun_30_year(year, month)
	let fracYear =  fraction_of_year(prevYear, nextYear, dateTime) 
	let prevYearCost = usd_p_gby(prevYear)
	let nextYearCost = usd_p_gby(nextYear)
	let cy = prevYearCost - (fracYear * (prevYearCost - nextYearCost))

	return cy * N_REPLICATIONS
}

const prev_jun_30_year = (y: number, m: number) => {
	if(m < 6) return y - 1  // JS months are 0-11
	return y
}

const next_jun_30_year = (y: number, m: number) => {
	if(m < 6) return y  
	return y + 1
}

const fraction_of_year = (prevYear: number, nextYear: number, datetime: Date) => {
	// fraction_of_year(PrevY, NextY, {{Y, Mo, D},{H, Mi, S}}) ->
	// 	Start = calendar:datetime_to_gregorian_seconds({{PrevY, 6, 30}, {23, 59, 59}}),
	// 	Now = calendar:datetime_to_gregorian_seconds({{Y, Mo, D}, {H, Mi, S}}),
	// 	End = calendar:datetime_to_gregorian_seconds({{NextY, 6, 30}, {23, 59, 59}}),
	// 	(Now - Start) / (End - Start).
	
	// Decimal.config({precision: 100}) // not sure how precise this needs to be yet

	let start = (new Date(prevYear, 5, 30, 23, 59, 59)).getTime()
	let end = new Date(nextYear, 5, 30, 23, 59, 59).getTime()
	let now = datetime.getTime()

	return (now - start) / (end - start)
}

const usd_p_gby = (y: number) => {
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

	// Decimal.config({precision: 100}) // not sure how precise this needs to be yet

	if(y === 2018) return (USD_PER_GBY_2018)
	if(y === 2019) return (USD_PER_GBY_2019)

	let k = (USD_PER_GBY_2019)
	let a = Math.log(USD_PER_GBY_DECAY_ANNUAL)
	let t = y - 2019

	return k * Math.exp(a * t)
}

export const txPerpetualStorage_calculateTxFee = (size: bigint, diff: bigint, height: number, timestamp: bigint) => {
	// calculate_tx_fee(DataSize, Diff, Height, Timestamp) ->
	// 	TXCost = calculate_tx_cost(DataSize, Diff, Height, Timestamp),
	// 	TXReward = calculate_tx_reward(TXCost),
	// 	TXCost + TXReward.

	let txCost = calculateTxCost(size, diff, height, timestamp)

	// calculate_tx_reward(TXCost) ->
	//	erlang:trunc(TXCost * ?MINING_REWARD_MULTIPLIER).
	let txReward = Math.floor(txCost * MINING_REWARD_MULTIPLIER)
	// let txReward = txCost / MINING_REWARD_DIVIDER //integer division

	return BigInt(txCost + txReward)
}

const calculateTxCost = (size: bigint, diff: bigint, height: number, timestamp: bigint) => {
	// if(height < FORK_HEIGHT_1_9) throw new Error("calculate_tx_cost not supported below FORK_HEIGHT_1_9")
	// %% @doc Perpetual storage cost to the network.
	// calculate_tx_cost(Bytes, Diff, Height, Timestamp) ->
	// 	GBs = (?TX_SIZE_BASE + Bytes) / (1024 * 1024 * 1024),
	// 	PerGB = usd_to_ar(perpetual_cost_at_timestamp(Timestamp), Diff, Height),
	// 	StorageCost = PerGB * GBs,
	// 	HashingCost = StorageCost,
	// 	erlang:trunc(StorageCost + HashingCost).

	/* N.B. These calculations are subject to JS Number rounding errors, and not expected to match Erlang values */

	// let bytes = TX_SIZE_BASE + size //leave that division to the end
	let gigaBytes = Number(TX_SIZE_BASE + size) / (1024 ** 3) // small fractional number
	let perGb = txPerpetualStorage_usdToAr(
		perpetualCostAtTimestamp(timestamp),
		diff,
		height,
	)
	let storageCost = (perGb) * gigaBytes
	let hashingCost = storageCost
	
	return Math.floor(storageCost + hashingCost) 
	// return (2n * perGb * bytes) / (1024n ** 3n) // <- integer math
}

const perpetualCostAtTimestamp = (timestamp: bigint) => {
	// perpetual_cost_at_timestamp(Timestamp) ->
	// 	K = get_cost_per_year_at_timestamp(Timestamp),
	// 	perpetual_cost(K, ?USD_PER_GBY_DECAY_ANNUAL).
	let k = getCostPerYearAtTimestamp(timestamp) 

	// return perpetual_cost(k, USD_PER_GBY_DECAY_ANNUAL)
	
	// perpetual_cost(Init, Decay) ->
	// 	Init / - math:log(Decay).

	return k / - Math.log(USD_PER_GBY_DECAY_ANNUAL)
}

const getCostPerYearAtTimestamp = (ts: bigint) => {
	let dateTime = new Date(Number(ts) * 1000) 
	
	return getCostPerYearAtDatetime(dateTime)
}

