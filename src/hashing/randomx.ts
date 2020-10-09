import { fork } from 'child_process'
import { ipcMsg2Uint8Array } from '../utils/buffer-utilities'

export const randomxHash = async (height: number, data: Uint8Array) => {
	let hashed: any = await promiseWrappedFork(height, data)
	return ipcMsg2Uint8Array(hashed.result)
}

/**
 * The ar-node-randomx addon causes nodejs to exhibit unwanted behaviour after it has been run once. 
 * For now, a workaround has been implemented: In order to mitigate this unpredictable behaviour we
 * are forking a new process to handle the addon code, and using IPC to communicate with it. This 
 * forked code is wrapped in a Promise as below.
 */
const promiseWrappedFork = async (height: number, data: Uint8Array) => {
	return new Promise( (resolve, reject) => {
		const forked = fork('src/hashing/randomx-child.ts')

		forked.send({height, data})

		forked.on('message', (msg) => {
			resolve(msg)
		})
	})
}

