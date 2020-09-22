/* An array of these defines the DTO for a /hash_list 3-tuple */
export interface BlockIndexTuple { 
	"tx_root": string //b64url
	"weave_size": string // integer in string format
	"hash": string //b64url
}