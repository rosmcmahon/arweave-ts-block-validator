import { ReturnCode, Block } from  './types'

export const validateBlock = (block:Block):ReturnCode =>{
	
	// Todo in the future:
	// if(peer banned) return {403, "IP address blocked due to previous request."}
	// if(http header "arweave-block-hash"  === known) return {208, "Block already processed."}
	


	return {code:200,message:"OK test"}
}