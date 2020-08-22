export interface Poa {
	// A succinct proof of access to a recall byte found in a TX.
	option: number //= "1" // The recall byte option (a sequence number) chosen.
	tx_path: Uint8Array // b64url encoded concatanation of hashes? // Path through the Merkle tree of TXs in the block.
	data_path: Uint8Array // b64url encoded concatanation of hashes? // Path through the Merkle tree of chunk IDs to the required chunk.
	chunk: Uint8Array // b64url encoded data // The required data chunk.
}

