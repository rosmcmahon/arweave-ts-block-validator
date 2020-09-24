import Arweave from "arweave"
import { BlockIndexDTO } from "../types"
import * as Merkle from '../utils/merkle'
import { bufferToBigInt } from '../utils/buffer-utilities'
import { POA_MIN_MAX_OPTION_DEPTH, ALTERNATIVE_POA_DIFF_MULTIPLIER } from '../constants'
import { multiplyDifficulty } from "../hashing/difficulty-retarget"

export interface Poa {
	// A succinct proof of access to a recall byte found in a TX.
	option: number				// The recall byte option (a sequence number) chosen.
	tx_path: Uint8Array		// base64url encoded concatanation of hashes. Path through the Merkle tree of TXs in the block.
	data_path: Uint8Array	// base64url encoded concatanation of hashes. Path through the Merkle tree of chunk IDs to the required chunk.
	chunk: Uint8Array			// base64url encoded data. The required data chunk.
}

/* Validate a complete proof of access object */
export const validatePoa = async (prevIndepHash: Uint8Array, prevWeaveSize: bigint, blockIndex: BlockIndexDTO, poa: Poa): Promise<Boolean> => {
	if(prevWeaveSize === 0n){
		return true // The weave does not have data yet.
	}
	if( (poa.option > blockIndex.length) && (poa.option > POA_MIN_MAX_OPTION_DEPTH) ){ 
		return false
	}

	/* Find the recall byte */

	let recallByte: bigint = bufferToBigInt(await poaMultiHash(prevIndepHash, poa.option)) % prevWeaveSize

	const {txRoot, blockBase, blockTop, bh} = findPoaChallengeBlock(recallByte, blockIndex)

	/* Validate */

	return await validateTxPath( (recallByte - blockBase), txRoot, (blockTop - blockBase), poa )
}

const validateTxPath = async (blockOffset: bigint, txRoot: Uint8Array, blockEndOffset: bigint, poa: Poa): Promise<boolean> =>{
	let merkleTxPathResult = await Merkle.validatePath(txRoot, blockOffset, 0n, blockEndOffset, poa.tx_path ) 

	//Merkle.validatePath returns false | data...

	if(merkleTxPathResult === false){
		return false
	}

	const { data: dataRoot, leftBound: startOffset, rightBound: endOffset} = merkleTxPathResult 
	
	let txOffset = blockOffset - startOffset 

	return await validateDataPath(dataRoot, txOffset, endOffset-startOffset, poa)
}

const validateDataPath = async (dataRoot: Uint8Array, txOffset: bigint, endOffset: bigint, poa: Poa) => {
	let merkleDataPathResult = await Merkle.validatePath(dataRoot, txOffset, 0n, endOffset, poa.data_path)

	//Merkle.validatePath returns false | { data, ...others }

	if(merkleDataPathResult === false){
		return false
	}

	const { data: chunkId } = merkleDataPathResult

	return poaValidateChunk(chunkId, poa)
}

const poaValidateChunk = async (chunkId: Uint8Array, poa: Poa) => {
	let hashed = await txGenerateChunkId(poa.chunk)
	return Buffer.from(chunkId).equals(hashed) 
}

const txGenerateChunkId = async (data: Uint8Array) => {
	return await Arweave.crypto.hash(data)
}

const poaMultiHash = async (data: Uint8Array, remaining: number): Promise<Uint8Array> => {
	if(remaining <= 0){
		return data;
	}
	let hashX = await Arweave.crypto.hash(data , 'SHA-256')
	return poaMultiHash(hashX, remaining - 1 )
}

export const findPoaChallengeBlock = (byte: bigint, blockIndex: BlockIndexDTO) => {
	// The base of the block is the weave_size tag of the previous_block. 
	// Traverse down the block index until the challenge block is inside the block's bounds.
	// Where: blockIndex[0] is the latest block, and blockIndex[blockIndex.length-1] is the earliest block
	let index0 = 0;
	let index1 = 1;
	while (index1 !== blockIndex.length) { //we should never reach past the first block without finding the block
		if( (byte >= BigInt(blockIndex[index1].weave_size)) && (byte < BigInt(blockIndex[index0].weave_size)) ){
			return { 
				txRoot: Arweave.utils.b64UrlToBuffer(blockIndex[index0].tx_root),
				blockBase: BigInt(blockIndex[index1].weave_size),
				blockTop: BigInt(blockIndex[index0].weave_size),
				bh: Arweave.utils.b64UrlToBuffer(blockIndex[index0].hash),// unused
			}
		}
		++index0; ++index1
	}
	//we can never get here from given program inputs.
	console.debug('recallByte out of bounds of weave') 
}

export const poa_modifyDiff = (diff: bigint, option: number): bigint => {
	if(option === 1){
		return diff
	}
	return poa_modifyDiff(
		multiplyDifficulty(diff, ALTERNATIVE_POA_DIFF_MULTIPLIER),
		option - 1
	)
}