
/**
 * A Transacion (Tx) Data Transfer Object (DTO)
 */
export class TxDTO {
	format:number = 2				// 1 or 2.
	id: string 							// txid
	//// Either the ID of the previous transaction made from this wallet or
	//// the hash of one of the last ?MAX_TX_ANCHOR_DEPTH blocks.
	last_tx:string 
	owner:string 						// Public key of transaction owner in b64url 
	tags:Tag[] = []					// Indexable TX category identifiers.
	target:string 					// Address of the recipient, if any.
	quantity:number = 0 		// Amount of Winston to send, if any.
	data:string 						// May be empty. May be submitted in a transfer transaction.
	data_size:string = '0'	// Size (in bytes) of the transaction data.
	data_tree:string[] = []	// The merkle tree of data chunks, the field is not signed.
	data_root:string 				// The merkle root of the merkle tree of data chunks.
	signature:string				// Transaction signature.
	reward:string 					// Transaction fee, in Winston.
}

interface Tag {
	name:string //b64url
	value:string //b64url
}