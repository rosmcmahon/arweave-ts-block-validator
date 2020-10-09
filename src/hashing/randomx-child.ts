import { RANDOMX_KEY_SWAP_FREQ } from "../constants"
import Arweave from "arweave"
import { RandomxCreateVM, RandomxHash, RandomxVMReference } from 'ar-node-randomx'
import ArCache from "arweave-cacher"
import { ipcMsg2Uint8Array } from '../utils/buffer-utilities'


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
 * This is our entrypoint. 
 * Since we are not mining we will be using RandomX hash_light and will not keep large randomX dataset in memory.
 */
process.on('message', async (msg:{key, data}) => {
	try{
		let data = ipcMsg2Uint8Array(msg.data)
		let key = ipcMsg2Uint8Array(msg.key)
		let result = await randomxHashChild(key, data)
		process.send({result})
		process.exit(0)
	}catch(e){
		console.log(e)
		process.exit(1)
	}
})
const randomxHashChild = async (key: Uint8Array, data: Uint8Array) => {
	let virtualMachine = await initLightRandomx(key)
	return hashLightRandomx(virtualMachine, data)
}


