import { MAX_DIFF } from "./constants"

export const difficulty_multiplyDiff = (diff: bigint, multiplier: number) => {
	let mult = BigInt(multiplier)
	let modifier = ((1n / mult) * (MAX_DIFF - diff))
	return MAX_DIFF - modifier
}