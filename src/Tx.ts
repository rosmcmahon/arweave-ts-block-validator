import { TxDTO } from "./types"
import Arweave from "arweave"
import Axios from "axios"
import { HOST_SERVER, DATA_CHUNK_SIZE } from "./constants"
import { MerkleElement, computeRootHash } from "./utils/merkle"
import deepHash from "./utils/deepHash"
import { arrayCompare } from "./utils/buffer-utilities"

interface Tag {
	name: string //these are left as base64url
	value: string
}

/**
 * A Transacion (Tx)
 */
export class Tx {
	format:number						// 1 or 2.
	idString: string				// txid as a b64url encoded string
	id: Uint8Array					// txid
	last_tx: Uint8Array			// Either id of last tx from same wallet, or block id from last 50 blocks
	owner: Uint8Array				// Public key of transaction owner
	tags: Tag[]							// Indexable TX category identifiers.
	target: string					// Address of the recipient, if any.
	quantity: bigint				// Amount of Winston to send, if any.
	data: Uint8Array				// May be empty. May be submitted in a transfer transaction.
	data_size: bigint				// Size (in bytes) of the transaction data.
	data_tree: Uint8Array[]	// The merkle tree of data chunks, the field is not signed.
	private data_root: Uint8Array		// The merkle root of the merkle tree of data chunks.
	signature: Uint8Array		// Transaction signature.
	reward: bigint					// Transaction fee, in Winston.

	constructor(dto: TxDTO){
		this.format = dto.format
		this.idString = dto.id
		this.id = Arweave.utils.b64UrlToBuffer(dto.id)
		this.last_tx = Arweave.utils.b64UrlToBuffer(dto.last_tx)
		this.owner = Arweave.utils.b64UrlToBuffer(dto.owner)
		this.tags = dto.tags // leave as b64url for hashing functions
		this.target = dto.target
		this.quantity = BigInt(dto.quantity)
		this.data = Arweave.utils.b64UrlToBuffer(dto.data)
		this.data_size = BigInt(dto.data_size)
		this.data_tree = dto.data_tree.map(x => Arweave.utils.b64UrlToBuffer(x))
		this.data_root = Arweave.utils.b64UrlToBuffer(dto.data_root)
		this.signature = Arweave.utils.b64UrlToBuffer(dto.signature)
		this.reward = BigInt(dto.reward)
	}

	static async getByIdString(txid: string): Promise<Tx> {
		let txDto = (await Axios.get(HOST_SERVER+'/tx/'+txid)).data
		return new Tx(txDto)
	}
	static async getById(txid: Uint8Array): Promise<Tx> {
		let txString = Arweave.utils.bufferTob64Url(txid)
		let txDto = (await Axios.get(HOST_SERVER+'/tx/'+txString)).data
		return new Tx(txDto)
	}

	public async getDataRoot() {
		if( (this.format === 1) && (this.data_root.length == 0) ){
			return await generateV1TxDataRoot(this)
		}
		if(this.format === 2){
			return this.data_root
		}
		throw new Error("Cannot get tx data_root of unsupported tx format = " + this.format)
	}

	private async getSignatureData(): Promise<Uint8Array> {
    switch (this.format) {
      case 1:
        let tagString = this.tags.reduce((accumulator: string, tag: Tag) => {
          return (
            accumulator +
            Arweave.utils.b64UrlToString(tag.name) +
            Arweave.utils.b64UrlToString(tag.value)
          );
        }, "");

        return Arweave.utils.concatBuffers([
					this.owner,
					Arweave.utils.b64UrlToBuffer(this.target),
					this.data,
					Arweave.utils.stringToBuffer(this.quantity.toString()),
					Arweave.utils.stringToBuffer(this.reward.toString()),
					this.last_tx,
          Arweave.utils.stringToBuffer(tagString)
        ]);
      case 2:
        const tagList: [Uint8Array, Uint8Array][] = this.tags.map(tag => [
          Arweave.utils.b64UrlToBuffer(tag.name),
          Arweave.utils.b64UrlToBuffer(tag.value),
        ]);

        return await deepHash([
          Arweave.utils.stringToBuffer(this.format.toString()),
          this.owner,
          Arweave.utils.b64UrlToBuffer(this.target),
          Arweave.utils.stringToBuffer(this.quantity.toString()),
          Arweave.utils.stringToBuffer(this.reward.toString()),
          this.last_tx,
          tagList,
          Arweave.utils.stringToBuffer(this.data_size.toString()),
          this.data_root,
        ]);
      default:
        throw new Error(`Unexpected transaction format: ${this.format}`);
    }
	} 
	
	async verify(): Promise<boolean> {
		/* This function verifies the signature and txid */
    const sigHash = await Arweave.crypto.hash(this.signature)

    if( !arrayCompare(this.id, sigHash) ) {
			// invalid signature or txid. Hash mismatch
			return false
		}
		
		const signaturePayload = await this.getSignatureData();

    return Arweave.crypto.verify(
      Arweave.utils.bufferTob64Url(this.owner),
      signaturePayload,
      this.signature
    );
	}

}

//#region generateV1TxDataRoot
export const generateV1TxDataRoot = async (tx: Tx): Promise<Uint8Array> => {
	if(tx.format !== 1) throw new Error("generateV1TxChunkTree only accepts V1 txs")

	let chunkIdSizes = await sizedChunksToSizedChunkHashes(
		chunksToSizeTaggedChunks(
			chunkBinary(tx.data)
		)
	)
	const root = await computeRootHash(chunkIdSizes)
	
	return root
}

const chunkBinary = (data: Uint8Array): Uint8Array[] => {
	if(data.length < DATA_CHUNK_SIZE){
		return [data]
	}

	let newChunk = data.slice(0, DATA_CHUNK_SIZE)
	let rest = data.slice(DATA_CHUNK_SIZE, data.length)

	return [newChunk, ...chunkBinary(rest)]
}

interface SizeTaggedChunk {
	data: Uint8Array
	offset: bigint
}

const chunksToSizeTaggedChunks = (chunks: Uint8Array[]) => {
	let pos = 0n
	let list: SizeTaggedChunk[] = []

	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		pos += BigInt(chunk.length)
		list = [
			...list,
			{ data: chunk, offset: pos }
		]
	}

	return list
}

const sizedChunksToSizedChunkHashes = async (sizeTaggedChunks: SizeTaggedChunk[]) => {
	return Promise.all(
		sizeTaggedChunks.map( 
			async (sizeTaggedChunk): Promise<MerkleElement> => {
				return {
					data: await Arweave.crypto.hash(sizeTaggedChunk.data),
					note: sizeTaggedChunk.offset
				}
			}
		)
	)
}
//#endregion generateV1TxDataRoot


