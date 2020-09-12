import axios from "axios"
import { Block, generateBlockDataSegment } from "../src/classes/Block"
import { HOST_SERVER, MAX_DIFF } from "../src/constants"
import { weave_hash } from "../src/hashing/weave-hash"
import { validateMiningDifficulty } from "../src/hashing/mine"
import { poa_modifyDiff } from "../src/classes/Poa"
import { arrayCompare } from "../src/utils/buffer-utilities"
import { WalletsObject, createWalletsFromDTO } from "src/classes/WalletsObject"


const main = async () => {

	let block1: Block
	let block2: Block

	const PASS = "\x1b[32mPASS:\x1b[0m"
	const FAIL = "\x1b[31mFAIL:\x1b[0m"

	/* Test data set up */

	try{

		const [
			bjKnownHash, 
			bjPrevKnownHash, 
		] = await Promise.all([
			axios.get(HOST_SERVER+'/block/height/509850'), //known, poa option 1, 
			axios.get(HOST_SERVER+'/block/height/509849'), //known, poa option 2
		])

		block1 = await Block.createFromDTO(bjKnownHash.data)
		block2 = await Block.createFromDTO(bjPrevKnownHash.data)
		
	}catch(e){
		console.debug('Network error! Could not retrieve tests data!', e.code)
		process.exit(1)
	}

	/* The tests */ 

	/* Test 1: check pow hash and validate poa.option = 1 */

	console.log('PoW. Validate pow satisfies mining difficulty and hash matches RandomX hash')
	console.log()
	console.log('Test 1: check pow hash and validate poa.option = 1')

	let pow1 = await weave_hash(
		(await generateBlockDataSegment(block1)), 
		block1.nonce, 
		block1.height
	)

	if( arrayCompare(pow1, block1.hash) ){
		console.log(PASS, "PoW 1 hash == RandomX hash")
	}else{
		console.log(FAIL, "PoW 1 hash != RandomX hash")
	}

	//check poa.option = 1
	let test1 = validateMiningDifficulty(pow1, poa_modifyDiff(block1.diff, block1.poa.option), block1.height)

	if (test1) {
		console.log(PASS, "Difficulty valid poa.option = 1")
	} else {
		console.log(FAIL, "Difficulty invalid with poa.option = 1")
	}

	/* Test 2: check pow hash and validate poa.option = 2 */

	console.log()
	console.log('Test 2: check pow hash and validate poa.option = 2')
	
	let pow2 = await weave_hash(
		(await generateBlockDataSegment(block2)), 
		block2.nonce, 
		block2.height
	)

	if( arrayCompare(pow2, block2.hash) ){
		console.log(PASS, "PoW 2 hash == RandomX hash")
	}else{
		console.log(FAIL, "PoW 2 hash != RandomX hash")
	}
	
	//check poa.option = 2
	let test2 = validateMiningDifficulty(pow2, poa_modifyDiff(block2.diff, block2.poa.option), block2.height)
	if (test2) {
		console.log(PASS, "Difficulty valid poa.option = 2")
	} else {
		console.log(FAIL, "Difficulty invalid with poa.option = 2")
	}

	console.log()
	console.log('Test 3: assert validateMiningDifficulty returns false for bad Difficulty')

	let test3 = validateMiningDifficulty(pow2, MAX_DIFF, block2.height)

	if (test3) {
		console.log(FAIL, "validateMiningDifficulty returned true for bad Difficulty")
	} else {
		console.log(PASS, "validateMiningDifficulty returned false for bad Difficulty")
	}

}
main();