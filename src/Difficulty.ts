import { mineMaxDiff } from "./Mine"

export const difficultyMultiplyDiff = (diff: bigint, multiplier: number) => {
	let maxDiff = mineMaxDiff()
	let mult = BigInt(multiplier)
	let modifier = ((1n / mult) * (maxDiff - diff))
	return maxDiff - modifier
}