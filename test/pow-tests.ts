import axios from "axios"
import { Block, generateBlockDataSegment } from "../src/Block"
import { Wallet_List } from "../src/types"
import { HOST_SERVER } from "../src/constants"
import { weave_hash } from "../src/Weave"
import { validateMiningDifficulty } from "../src/mine"
import { poa_modifyDiff } from "../src/Poa"
import { arrayCompare } from "../src/utils/buffer-utilities"


const main = async () => {

	let block1: Block
	let block2: Block
	let block2WalletList: Wallet_List[]

	/* test data set up */

	try{

		const [
			bjKnownHash, 
			bjPrevKnownHash, 
			bjPrevWalletList, 
		] = await Promise.all([
			axios.get(HOST_SERVER+'/block/height/509850'), //known, poa option 1, 
			axios.get(HOST_SERVER+'/block/height/509849'), //known, poa option 2
			axios.get('https://arweave.net/block/height/509849/wallet_list'), //arweave.net keeps old wallet_list
		])

		block1 = await Block.createFromDTO(bjKnownHash.data)
		block2 = await Block.createFromDTO(bjPrevKnownHash.data)
		block2WalletList = bjPrevWalletList.data
		
	}catch(e){
		console.debug('Network error! Could not retrieve tests data!', e.code)
		process.exit(1)
	}

	/* the tests */ 

	console.log('PoW. Validate pow satisfies mining difficulty and hash matches RandomX hash')

	// test 1: check pow hash and validate poa.option = 1

	let pow1 = await weave_hash(
		(await generateBlockDataSegment(block1)), 
		block1.nonce, 
		block1.height
	)

	if( arrayCompare(pow1,block1.hash) ){
		console.log("TEST PASSED: PoW hash == RandomX hash")
	}else{
		console.log("TEST FAIED: PoW hash != RandomX hash")
	}

	//check poa.option = 1
	let test1 = validateMiningDifficulty(pow1, poa_modifyDiff(block1.diff, block1.poa.option), block1.height)

	if (test1) {
		console.log("TEST PASSED: poa.option = 1")
	} else {
		console.log("TEST FAILED: poa.option = 1")
	}

	// test 2: check pow hash and validate poa.option = 2
	
	let pow2 = await weave_hash(
		(await generateBlockDataSegment(block2)), 
		block2.nonce, 
		block2.height
	)

	if( arrayCompare(pow2,block2.hash) ){
		console.log("TEST PASSED: PoW 2 hash == RandomX hash")
	}else{
		console.log("TEST FAIED: PoW 2 hash != RandomX hash")
	}
	
	//check poa.option = 2
	let test2 = validateMiningDifficulty(pow2, poa_modifyDiff(block2.diff, block2.poa.option), block2.height)
	if (test2) {
		console.log("TEST PASSED: poa.option = 2")
	} else {
		console.log("TEST FAILED: poa.option = 2")
	}


}
main();