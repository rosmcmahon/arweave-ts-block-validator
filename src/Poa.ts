import Arweave from "arweave"
import { BlockIndexTuple } from "./types"
import * as Merkle from './utils/merkle'
import { bufferToBigInt } from './utils/buffer-utilities'
import { POA_MIN_MAX_OPTION_DEPTH } from './constants'

export interface Poa {
	// A succinct proof of access to a recall byte found in a TX.
	option: number //= "1" // The recall byte option (a sequence number) chosen.
	tx_path: Uint8Array // b64url encoded concatanation of hashes? // Path through the Merkle tree of TXs in the block.
	data_path: Uint8Array // b64url encoded concatanation of hashes? // Path through the Merkle tree of chunk IDs to the required chunk.
	chunk: Uint8Array // b64url encoded data // The required data chunk.
}

/* Validate a complete proof of access object */
export const validatePoa = async (prevIndepHash: Uint8Array, prevWeaveSize: number, blockIndex: BlockIndexTuple[], poa: Poa): Promise<Boolean> => {
	
	/* some quick returns */
	
	// The weave does not have data yet.
	if(prevWeaveSize === 0) return true

	// validate(_H, _WS, BI, #poa{ option = Option })
	// 		when Option > length(BI) andalso Option > ?MIN_MAX_OPTION_DEPTH ->
	// 	false;
	if( (poa.option > blockIndex.length) && (poa.option > POA_MIN_MAX_OPTION_DEPTH) ){ 
		return false
	}

	// validate(LastIndepHash, WeaveSize, BI, POA) ->
	// 	RecallByte = calculate_challenge_byte(LastIndepHash, WeaveSize, POA#poa.option),
	// 	{TXRoot, BlockBase, BlockTop, _BH} = find_challenge_block(RecallByte, BI),
	// 	validate_tx_path(RecallByte - BlockBase, TXRoot, BlockTop - BlockBase, POA).

	// calculate_challenge_byte(_, 0, _) -> 0;
	// calculate_challenge_byte(LastIndepHash, WeaveSize, Option) ->
	// 	binary:decode_unsigned(multihash(LastIndepHash, Option)) rem WeaveSize.
	// -----------------------------------
	// if(prevWeaveSize===0){ // we have already returned true for this condition
	// 	recallByte = 0n
	// }else{
	let recallByte: bigint = bufferToBigInt(await poaMultiHash(prevIndepHash, poa.option)) % BigInt(prevWeaveSize)

	const {txRoot, blockBase, blockTop, bh} = poaFindChallengeBlock(recallByte, blockIndex)


	return await validateTxPath( Number(recallByte - blockBase), txRoot, Number(blockTop - blockBase), poa )
}

const validateTxPath = async (blockOffset: number, txRoot: Uint8Array, blockEndOffset: number, poa: Poa): Promise<boolean> =>{
	// validate_tx_path(BlockOffset, TXRoot, BlockEndOffset, POA) ->
	// 	Validation =
	// 		ar_merkle:validate_path(
	// 			TXRoot,
	// 			BlockOffset,
	// 			BlockEndOffset,
	// 			POA#poa.tx_path
	// 		),
	// 	case Validation of
	// 		false -> false;
	// 		{DataRoot, StartOffset, EndOffset} ->
	// 			TXOffset = BlockOffset - StartOffset,
	// 			validate_data_path(DataRoot, TXOffset, EndOffset - StartOffset, POA)
	// 	end.

	let merkleTxPathResult = await Merkle.validatePath(txRoot, blockOffset, 0, blockEndOffset, poa.tx_path ) 

	if(merkleTxPathResult === false){
		// console.debug('merkleTxPathResult === false')
		return false
	}

	const { data: dataRoot, leftBound: startOffset, rightBound: endOffset} = merkleTxPathResult 
	
	let txOffset = blockOffset - startOffset 

	return await validateDataPath(dataRoot, txOffset, endOffset-startOffset, poa)
}

const validateDataPath = async (dataRoot: Uint8Array, txOffset: number, endOffset: number, poa: Poa) => {
	// validate_data_path(DataRoot, TXOffset, EndOffset, POA) ->
	// 	Validation =
	// 		ar_merkle:validate_path(
	// 			DataRoot,
	// 			TXOffset,
	// 			EndOffset,
	// 			POA#poa.data_path
	// 		),
	// 	case Validation of
	// 		false -> false;
	// 		{ChunkID, _, _} ->
	// 			validate_chunk(ChunkID, POA)
	// 	end.

	let merkleDataPathResult = await Merkle.validatePath(dataRoot, txOffset, 0, endOffset, poa.data_path)

	if(merkleDataPathResult === false){
		console.debug('merkleDataPathResult === false')
		return false
	}

	const { data: chunkId } = merkleDataPathResult

	return poaValidateChunk(chunkId, poa)
}

const poaValidateChunk = async (chunkId: Uint8Array, poa: Poa) => {
	// validate_chunk(ChunkID, POA) ->
	// 	ChunkID == ar_tx:generate_chunk_id(POA#poa.chunk).
	let hashed = await txGenerateChunkId(poa.chunk)
	return Buffer.from(chunkId).equals(hashed) //arrayCompare(chunkId, hashed)
}

const txGenerateChunkId = async (data: Uint8Array) => {
	// 	%% @doc Generate a chunk ID according to the specification found in the TX record.
	// generate_chunk_id(Chunk) ->
	// 	crypto:hash(sha256, Chunk).
	return await Arweave.crypto.hash(data)
}

const poaMultiHash = async (data: Uint8Array, remaining: number): Promise<Uint8Array> => {
	// multihash(X, Remaining) when Remaining =< 0 -> X;
	// multihash(X, Remaining) ->
	// 	multihash(crypto:hash(?HASH_ALG, X), Remaining - 1).
	if(remaining <= 0){
		return data;
	}
	let hashX = await Arweave.crypto.hash(data , 'SHA-256')
	return poaMultiHash(hashX, remaining - 1 )
}

export const poaFindChallengeBlock = (byte: bigint, blockIndex: BlockIndexTuple[]) => {
	// The base of the block is the weave_size tag of the previous_block. 
	// Traverse down the block index until the challenge block is inside the block's bounds.
	// Where: blockIndex[0] is the latest block, and blockIndex[blockIndex.length-1] is the earliest block
	// find_challenge_block(Byte, [{BH, BlockTop, TXRoot}, {_, BlockBase, _} | _])
	// 	when (Byte >= BlockBase) andalso (Byte < BlockTop) -> {TXRoot, BlockBase, BlockTop, BH};
	// find_challenge_block(Byte, [_ | BI]) ->
	// 	find_challenge_block(Byte, BI).
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
	//we should never get here
	throw new Error('recallByte out of bounds of weave')
}

