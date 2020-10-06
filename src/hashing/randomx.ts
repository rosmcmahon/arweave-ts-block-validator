import { fork } from 'child_process'
import { ipcMsg2Uint8Array } from '../utils/buffer-utilities'

export const randomxHash = async (height: number, data: Uint8Array) => {
	let hashed: any = await promisedForkWrapper(height, data)
	return ipcMsg2Uint8Array(hashed.result)
}

const promisedForkWrapper = async (height: number, data: Uint8Array) => {
	return new Promise( (resolve, reject) => {
		const forked = fork('src/hashing/randomx-child.ts')

		forked.send({height, data})

		forked.on('message', (msg) => {
			resolve(msg)
		})
	})
}

