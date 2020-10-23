import { Decimal } from 'decimal.js'
import { BLOCKS_PER_YEAR, GENESIS_TOKENS, WINSTON_PER_AR, ADD_APPROXIMATION } from '../constants'

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

	// Decimal.config({precision: 25}) // more than enough precision
	// let log2 = Decimal.ln(2) //a float constant
	// let years = new Decimal(height).dividedBy(BLOCKS_PER_YEAR)
	// let powerExp = Decimal.pow(2, years.neg()) //2^years_since_genesis
	// let bigFloat = ( Decimal.mul(0.2, GENESIS_TOKENS).mul(powerExp).mul(log2) ).dividedBy(BLOCKS_PER_YEAR)
	
	// if(ADD_APPROXIMATION){
	// 	return Number(
	// 		bigFloat.mul(WINSTON_PER_AR)
	// 	)
	// }
	// // return bigFloat.mul(WINSTON_PER_AR) // without rounding error

	return WINSTON_PER_AR * (
		(0.2 * GENESIS_TOKENS * Math.pow(2, -height/BLOCKS_PER_YEAR) * Math.log(2)) / BLOCKS_PER_YEAR
	)
}
