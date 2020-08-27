import { FORK_HEIGHT_1_7 } from './constants'
import Arweave from 'arweave'
import { randomxStateHash } from './RandomxState'

export const weaveHash = async (bds: Uint8Array, nonce: Uint8Array, height: number) => {
	if(height < FORK_HEIGHT_1_7){
		throw new Error("weaveHash below FORK_HEIGHT_1_7 not implemented")
	}
	const hashData = Arweave.utils.concatBuffers([nonce, bds])
	return await randomxStateHash(height, hashData)
}