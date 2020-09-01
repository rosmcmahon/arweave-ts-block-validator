import axios from 'axios'
import Arweave from "arweave"
import { BlockDTO, ReturnCode, BlockIndexTuple, Wallet_List } from './types'
import { STORE_BLOCKS_AROUND_CURRENT, HOST_SERVER, RETARGET_BLOCKS } from './constants'
import { validateBlockJson, validateBlockQuick } from "./BlockValidateQuick"
import { validateBlockSlow } from './BlockValidateSlow'
import { Block,	generateBlockDataSegmentBase, generateBlockDataSegment, getIndepHash } from './Block'
import { poa_validate, poa_findChallengeBlock, poa_modifyDiff } from './Poa'
import { retarget_validateDiff } from './Retarget'
import { weave_hash } from './Weave'
import { mine_validate } from './Mine'
import { Tx } from './Tx'
import { nodeUtils_updateWallets } from './NodeUtils'

/* *** Initialise all test data, and use in one big test file *** */

let res: ReturnCode
let blockJson: BlockDTO
let blockKnownHash: Block
let prevBlockKnownHash: Block

let block: Block
let prevBlock: Block
let prevPrevBlock: Block
let blockIndex: BlockIndexTuple[]
let prevBlockWalletList: Wallet_List[]

beforeAll(async () => {
	const currentHeight = Number((await axios.get(HOST_SERVER+'/info')).data.height)
	//we want height % 10 so we get difficulty retarget block
	let workingHeight = currentHeight - (currentHeight % RETARGET_BLOCKS)

	const [
		bIndex, 
		bjKnownHash, 
		bjPrevKnownHash, 

		bj1, 
		bj2, 
		bj2WalletList, 
		bj3
	] = await Promise.all([
		axios.get(HOST_SERVER+'/hash_list', { // any random node
			headers: { "X-Block-Format": "3" }  // need to set this header to get tuples
		}),
		axios.get(HOST_SERVER+'/block/height/509850'), //known hash, poa option 1
		axios.get(HOST_SERVER+'/block/height/509849'), //known hash, poa option 2
		axios.get(HOST_SERVER+'/block/height/'+(workingHeight).toString()), 
		axios.get(HOST_SERVER+'/block/height/'+(workingHeight-1).toString()), 
		axios.get(HOST_SERVER+'/block/height/'+(workingHeight-1).toString()+'/wallet_list'), //wallet_list needs to come from recent transaction!
		axios.get(HOST_SERVER+'/block/height/'+(workingHeight-2).toString()), 
	])
	blockIndex = bIndex.data
	blockKnownHash = new Block(bjKnownHash.data)
	prevBlockKnownHash = new Block(bjPrevKnownHash.data)

	blockJson = bj1.data
	block = new Block(blockJson)
	prevBlock = new Block(bj2.data)
	prevBlockWalletList = (bj2WalletList.data)
	prevPrevBlock = new Block(bj3.data)
}, 60000)



describe('BlockValidateQuick Tests', () => {

  it('validateBlockJson should return true for a valid block', async () => {
		res = validateBlockJson(blockJson, blockJson.height-1 )
		
    expect(res).toEqual({code: 200, message: "Block Json OK."})
  })

  it('validateBlockQuick should return false for an out of range height', async () => {
    let ahead = validateBlockQuick( block, block.height - (STORE_BLOCKS_AROUND_CURRENT+10) )
		expect(ahead).toEqual({code: 400, message: "Height is too far ahead"})
		
    let behind = validateBlockQuick( block, block.height + (STORE_BLOCKS_AROUND_CURRENT+10) )
    expect(behind).toEqual({code: 400, message: "Height is too far behind"})
	})
	
	it('validateBlockQuick should return false for difficulty too low', async () => {
		let test = Object.assign({},block)
		test.diff = 1n		                                 //TODO: better good/bad difficulties

    res = validateBlockQuick(test, block.height-1 )
    expect(res).toEqual({code: 400, message: "Difficulty too low"})
	})
})

describe('Block tests', () => {


  beforeAll(async () => {
		const [] = await Promise.all([
			axios.get(HOST_SERVER+'/block/height/509850'), //need 509850 for Block hash test results
			axios.get(HOST_SERVER+'/block/height/509849'),
		])

  }, 20000)

	it('generateBlockDataSegmentBase returns a valid BSDBase hash', async () => {
		expect.assertions(1)
		let hash = await generateBlockDataSegmentBase(blockKnownHash)
		let data = Arweave.utils.bufferTob64Url(hash)
		
		expect(data).toEqual("dOljnXSULT9pTX4wiagcUOqrZZjBWLwKBR3Aoe3-HhNAW_CiKHNsrvqwL14x6BMm") 
		//BDSBase for /height/509850 hash/si5OoWK-OcYt3LOEDCP2V4SWuj5X5n1LdoTh09-DtOppz_VkE72Cb0DCvygYMbW5
	}, 20000)

	it('generateBlockDataSegment returns a valid BSD hash', async () => {
		expect.assertions(1)
		let hash = await generateBlockDataSegment(blockKnownHash)
		let data = Arweave.utils.bufferTob64Url(hash)

		expect(data).toEqual("uLdZH6FVM-TI_KiA8oZCGbqXwknwyg69ur7KPrSMVPcBljPnIzeOhnPRPyOoifWV") 
		//BDSBase for /height/509850 hash/si5OoWK-OcYt3LOEDCP2V4SWuj5X5n1LdoTh09-DtOppz_VkE72Cb0DCvygYMbW5
	}, 20000)

	it('getIndepHash returns a valid hash', async () => {
		expect.assertions(1)
		let hash: any = await getIndepHash(blockKnownHash)
		
		expect(new Uint8Array(hash)).toEqual(blockKnownHash.indep_hash) 
	}, 20000)
	
	it('returns an array of the Block Tx objects', async () => {
		expect.assertions(blockKnownHash.txids.length * 2 + 1)

		let txs = await blockKnownHash.getTxs()

		for (let index = 0; index < blockKnownHash.txids.length; index++) {
			expect(txs[index]).toBeInstanceOf(Tx)
			let idString = Arweave.utils.bufferTob64Url( blockKnownHash.txids[index] )
			expect(txs[index].idString).toEqual(idString)
		}

		expect(prevBlockKnownHash.txs).toBeUndefined()

	}, 20000)

})

describe('PoA tests', () => {
	
	it('Poa.poaFindChallengeBlock returns a valid block depth', async () => {
		let testByte =  500000n
	
		const {txRoot, blockBase, blockTop, bh} = poa_findChallengeBlock(testByte, blockIndex)
	
		expect(testByte).toBeGreaterThan(blockBase) 
		expect(testByte).toBeLessThanOrEqual(blockTop) 
	}, 20000)
	
	it('Poa.validatePoa returns true/false for valid/invalid Poa', async () => {
		expect.assertions(2)
		let good = await poa_validate(prevBlock.indep_hash, prevBlock.weave_size, blockIndex, block.poa) 
		let badPoa = prevBlock.poa
		let bad = await poa_validate(prevBlock.indep_hash, prevBlock.weave_size, blockIndex, badPoa)
	
		expect(good).toEqual(true) 
		expect(bad).toEqual(false) 
	})
})

describe('BlockValidateSlow tests', () => {

	it('Retarget.retargetValidateDiff Validate that a new block has an appropriate difficulty.', async () =>{
		let retarget = retarget_validateDiff(block, prevBlock)
		let noRetarget = retarget_validateDiff(prevBlock, prevPrevBlock)

		expect(retarget).toEqual(true)
		expect(noRetarget).toEqual(true)

	}, 20000)

	it('PoW. Validate pow satisfies mining difficulty and hash matches RandomX hash', async () =>{
		expect.assertions(4)
		let pow1 = await weave_hash((await generateBlockDataSegment(blockKnownHash)), blockKnownHash.nonce, blockKnownHash.height)
		//check poa.option = 1
		let test1 = mine_validate(pow1, poa_modifyDiff(blockKnownHash.diff, blockKnownHash.poa.option), blockKnownHash.height)
		expect(pow1).toEqual(blockKnownHash.hash)
		expect(test1).toEqual(true)
		
		let pow2 = await weave_hash((await generateBlockDataSegment(prevBlockKnownHash)), prevBlockKnownHash.nonce, prevBlockKnownHash.height)
		//check poa.option = 2
		let test2 = mine_validate(pow2, poa_modifyDiff(prevBlockKnownHash.diff, prevBlockKnownHash.poa.option), prevBlockKnownHash.height)
		expect(pow2).toEqual(prevBlockKnownHash.hash)
		expect(test2).toEqual(true)
	})

	// it('WalletList. Validates that value transactions result in valid wallet list', async () => {
	// 	expect.assertions(1)
	// 	// just testing a bad walletList here, as a correct one is validated in validateBlockSlow test.
	// 	let { } = await nodeUtils_updateWallets()


	// }, 20000)


	it('validateBlockSlow should return true when given valid block data', async () => {
		expect.assertions(1)
		res = await validateBlockSlow(block, prevBlock, blockIndex, prevBlockWalletList)
			
		expect(res).toEqual({code:200, message:"Block slow check OK"})
	}, 20000)

})