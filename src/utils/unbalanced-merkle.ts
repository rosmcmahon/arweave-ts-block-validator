import deepHash from "./deepHash"
import Arweave from "arweave"


export const unbalancedMerkle_root = async (oldRoot: Uint8Array, data: Uint8Array) => {
	const hashData = Arweave.utils.concatBuffers([
		oldRoot,
		data
	])
	return await Arweave.crypto.hash(hashData, "SHA-384")
}


export const unbalancedMerkle_hashBlockIndexEntry = async (blockHash: Uint8Array, weaveSize: bigint, txRoot: Uint8Array) => {
	return await deepHash([
		blockHash,
		Arweave.utils.stringToBuffer( weaveSize.toString() ),
		txRoot
	])
}