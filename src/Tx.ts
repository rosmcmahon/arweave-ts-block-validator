import { TxDTO } from "./types"
import Arweave from "arweave"
import Axios from "axios"
import { HOST_SERVER } from "./constants"

/**
 * A Transacion (Tx)
 */
export class Tx {
	format:number = 2				// 1 or 2.
	idString: string 							// txid
	id: Uint8Array 							// txid
	//// Either the ID of the previous transaction made from this wallet or
	//// the hash of one of the last ?MAX_TX_ANCHOR_DEPTH blocks.
	last_tx: Uint8Array 
	owner: Uint8Array 						// Public key of transaction owner in b64url 
	tags: Tag[]					// Indexable TX category identifiers.
	target:string 					// Address of the recipient, if any.
	quantity: bigint		// Amount of Winston to send, if any.
	data:string 						// May be empty. May be submitted in a transfer transaction.
	data_size: bigint 	// Size (in bytes) of the transaction data.
	data_tree: Uint8Array[] 	// The merkle tree of data chunks, the field is not signed.
	data_root: Uint8Array 				// The merkle root of the merkle tree of data chunks.
	signature: Uint8Array				// Transaction signature.
	reward: bigint 					// Transaction fee, in Winston.

	constructor(dto: TxDTO){
		this.format = dto.format
		this.idString = dto.id
		this.id = Arweave.utils.b64UrlToBuffer(dto.id)
		this.last_tx = Arweave.utils.b64UrlToBuffer(dto.last_tx)
		this.owner = Arweave.utils.b64UrlToBuffer(dto.owner)
		this.tags = dto.tags // do these get decoded?
		this.target = dto.target
		this.quantity = BigInt(dto.quantity)
		// this.data = dto.data
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

}

interface Tag {
	name: string //should these be decoded from b64url ?
	value: string
}