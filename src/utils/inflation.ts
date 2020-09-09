import { Decimal } from 'decimal.js'
import { BLOCKS_PER_YEAR, GENESIS_TOKENS, WINSTON_PER_AR } from '../constants'

export const calculateInflation = (height: number) => {
	/*
		calculate_base(Height) ->
			WINSTON_PER_AR * (
				(0.2 * ?GENESIS_TOKENS * math:pow(2,-(Height)/?BLOCK_PER_YEAR) * math:log(2)) / ?BLOCK_PER_YEAR
			).
	*/
	/**
	 * This calculation will involve floating point numbers and large integers.
	 * Rough maths says the return int value need to be correct to about 19 decimal places (decreasing as the years pass) 
	 */
	Decimal.config({precision: 25, rounding: Decimal.ROUND_FLOOR}) // more than enough precision
	let log2 = Decimal.ln(2) //a float constant
	let years = new Decimal(height).dividedBy(BLOCKS_PER_YEAR)
	let powerExp = Decimal.pow(2,-(years)) //2^years_since_genesis
	let bigFloat = Decimal.mul(0.2, GENESIS_TOKENS).mul(powerExp).mul(log2)
	
	return bigFloat.mul(WINSTON_PER_AR)
}
