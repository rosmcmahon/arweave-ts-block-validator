import { mineMaxDiff } from "./Mine"

export const difficultyMultiplyDiff = (diff: number, multiplier: number) => {
	let maxDiff = mineMaxDiff()
	let modifier = Math.floor((1 / multiplier) * (maxDiff - diff))
	return maxDiff - modifier
}