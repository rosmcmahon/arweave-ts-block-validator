import Arweave from 'arweave'
import ArCache from 'arweave-cacher'
import { fork } from 'child_process'
import { ipcMsg2Uint8Array } from '../utils/buffer-utilities'
import col from 'ansi-colors'
import { consoleVerbose } from "../utils/logger"
import { RANDOMX_KEY_SWAP_FREQ } from '../constants'

export const randomxHash = async (height: number, data: Uint8Array) => {
	let key = await randomxKeyByHeight(height)
	let hashed: any = await promiseWrappedFork(key, data)
	return ipcMsg2Uint8Array(hashed.result)
}

/**
 * The ar-node-randomx addon causes nodejs to exhibit unwanted behaviour after it has been run once. 
 * For now, a workaround has been implemented: In order to mitigate this unpredictable behaviour we
 * are forking a new process to handle the addon code, and using IPC to communicate with it. This 
 * forked code is wrapped in a Promise as below.
 */
const promiseWrappedFork = async (key: Uint8Array, data: Uint8Array) => {
	return new Promise( (resolve, reject) => {
		const forked = fork('src/hashing/randomx-child.ts')

		forked.send({key, data})

		forked.on('message', (msg) => {
			resolve(msg)
		})
	})
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

	consoleVerbose(col.blue("randomx key block height and hash: "), keyBlockHeight, keyBlock.hash)

	return Arweave.utils.b64UrlToBuffer(keyBlock.hash)
}
