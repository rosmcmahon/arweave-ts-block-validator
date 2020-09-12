import { RANDOMX_KEY_SWAP_FREQ } from "./constants"
import { Block } from "./classes/Block"
import Arweave from "arweave"
let Randomx = require('../node-randomx/build/Release/addon')

/* Use the RandomX node-addon to set up a "VM" and do the hashing */

const initLightRandomx = async (key: Uint8Array) => {
	let vm: Object
	try{
		vm = await Randomx.RandomxVM(key.buffer, ["jit"])
	}
	catch(e){
		console.log(e)
		throw new Error("Error creating RandomX VM.")
	}
	return vm
}

const hashLightRandomx = async (vm: Object, data: Uint8Array) => {
	let hash: ArrayBuffer
	try {
		hash = await Randomx.hash(vm, data.buffer)
	} catch (e) {
		console.log(e)
		throw new Error("Error when RandomX hashing.")
	}
	return new Uint8Array( hash )
}

/**
 * Since we are not mining we will be using RandomX hash_light and will not keep large randomX dataset in memory.
 */

export const randomxHash = async (height: number, data: Uint8Array) => {
	let key = await randomxKeyByHeight(height)
	let virtualMachine = await initLightRandomx(key)
	return hashLightRandomx(virtualMachine, data)
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

