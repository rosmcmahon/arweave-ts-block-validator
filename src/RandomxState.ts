import { RANDOMX_KEY_SWAP_FREQ } from "./constants"
import { Block } from "./Block"
import Arweave from "arweave"
import { mineRandomxInitLight, mineRandomxHashLight } from "./MineRandomx"

/**
 * Based on ar_randomx_state.erl in name only.
 * Since we are not mining we will be using RandomX hash_light and will not keep randomX state in memory.
 */

export const randomxStateHash = async (height: number, data: Uint8Array) => {
	/*
		hash(Height, Data) ->
			case randomx_state_by_height(Height) of
				{state, {fast, FastState}} ->
					ar_mine_randomx:hash_fast(FastState, Data);
				{state, {light, LightState}} ->
					ar_mine_randomx:hash_light(LightState, Data);
				{key, Key} ->
					LightState = ar_mine_randomx:init_light(Key),
					ar_mine_randomx:hash_light(LightState, Data)
			end.
	*/
	let key = await randomxKeyByHeight(height)
	let virtualMachine = await mineRandomxInitLight(key)
	return mineRandomxHashLight(virtualMachine, data)
}

const randomxKeyByHeight = async (height: number) => {
	let swapHeight = height - (height % RANDOMX_KEY_SWAP_FREQ) //rounding to nearest multiple
	return randomxKey(swapHeight)
}

const randomxKey = async (swapHeight: number) => {
	if(swapHeight < RANDOMX_KEY_SWAP_FREQ){
		return Arweave.utils.stringToBuffer("Arweave Genesis RandomX Key")
	}
	//keyBlockHeight gives at least 2000 blocks warning (miners need time to generate RandomX state)
	let keyBlockHeight = swapHeight - RANDOMX_KEY_SWAP_FREQ 
	const keyBlock = await Block.getByHeight(keyBlockHeight)

	return keyBlock.hash
}

