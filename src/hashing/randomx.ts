import { RANDOMX_KEY_SWAP_FREQ } from "../constants"
import Arweave from "arweave"
import { RandomxCreateVM, RandomxHash, RandomxVMReference } from 'ar-node-randomx'
import ArCache from "arweave-cacher"

/* Use the RandomX node-addon to set up a "VM" and do the hashing */

const initLightRandomx = async (key: Uint8Array) => {
	let vm: RandomxVMReference
	try{
		vm = RandomxCreateVM(key, ["jit"])
	}
	catch(e){
		console.log(e)
		throw new Error("Error creating RandomX VM.")
	}
	return vm
}

const hashLightRandomx = async (vm: RandomxVMReference, data: Uint8Array) => {
	let hash: ArrayBuffer
	try {
		hash = RandomxHash(vm, data)
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
	const keyBlock = await ArCache.getBlockDtoByHeight(keyBlockHeight)

console.log("\x1b[31mrandomx-debugging:\x1b[0m", "keyBlockHeight", keyBlockHeight)

	return Arweave.utils.b64UrlToBuffer(keyBlock.hash)
}

