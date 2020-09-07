import axios from 'axios'
import { BlockDTO, ReturnCode, BlockIndexTuple, Wallet_List } from './types'
import { STORE_BLOCKS_AROUND_CURRENT, HOST_SERVER, RETARGET_BLOCKS } from './constants'
import { validateBlockJson, validateBlockQuick } from './blockValidateQuick'
import { Block, blockFieldSizeLimit, block_verifyWeaveSize, block_verifyBlockHashListMerkle } from './Block'
import { poa_validate, poa_findChallengeBlock } from './Poa'
import { retarget_validateDiff } from './difficulty-retarget'
import { Tx } from './Tx'

/* *** Initialise all test data, and use in one big test file *** */

jest.retryTimes(0);

let res: ReturnCode
let blockJson: BlockDTO

let block: Block
let prevBlock: Block
let prevPrevBlock: Block
let blockIndex: BlockIndexTuple[]  //for PoA and full test
let prevBlockWalletList: Wallet_List[]

beforeAll(async () => {
	try{
		const currentHeight = Number((await axios.get(HOST_SERVER+'/info')).data.height)
		//we want height % 10 so we get a difficulty retarget block
		let workingHeight = currentHeight - (currentHeight % RETARGET_BLOCKS)
		//518960 <- Invalid difficulty
		//DiffInverse for 518960:
		//14231183094510643579717614561666284022583822524602630177890580299776


		const [
			bIndex, 

			bj1, 
			bj2, 
			bj2WalletList, 
			bj3
		] = await Promise.all([
			axios.get(HOST_SERVER+'/hash_list', { headers: { "X-Block-Format": "3" } }), // tuples header unavailable on arweave.net

			axios.get(HOST_SERVER+'/block/height/'+(workingHeight).toString()), 
			axios.get(HOST_SERVER+'/block/height/'+(workingHeight-1).toString()), 
			axios.get('https://arweave.net/block/height/'+(workingHeight-1).toString()+'/wallet_list'), //arweave.net keeps old
			axios.get(HOST_SERVER+'/block/height/'+(workingHeight-2).toString()), 
		])
		blockIndex = bIndex.data

		blockJson = bj1.data
		block = await Block.createFromDTO(blockJson)
		prevBlock = await Block.createFromDTO(bj2.data)
		prevBlockWalletList = (bj2WalletList.data)
		prevPrevBlock = await Block.createFromDTO(bj3.data)

	}catch(e){
		console.debug('Network error! Could not retrieve tests data!', e.code)
		process.exit(1)
	}

}, 60000)



describe('BlockValidateQuick Tests', () => {

  it('validateBlockJson should return true for a valid block', async () => {
		expect.assertions(1)
		let result = await validateBlockJson(blockJson )
		
    expect(result).toEqual(true)
  }, 20000)

  it('validateBlockQuick should return false for an out of range height', async () => {
		expect.assertions(2)

    let ahead = validateBlockQuick(blockJson, block, block.height - (STORE_BLOCKS_AROUND_CURRENT+10) )
		expect(ahead).toEqual({code: 400, message: "Height is too far ahead"})
		
    let behind = validateBlockQuick(blockJson, block, block.height + (STORE_BLOCKS_AROUND_CURRENT+10) )
    expect(behind).toEqual({code: 400, message: "Height is too far behind"})
	})
	
	it('validateBlockQuick should return false for difficulty too low', async () => {
		expect.assertions(1)
		let test = Object.assign({},block)
		test.diff = 1n		                                 //TODO: better good/bad difficulties

    res = validateBlockQuick(blockJson, test, block.height-1 )
    expect(res).toEqual({code: 400, message: "Difficulty too low"})
	})
})

describe('Block tests, general validation tests', () => {

	it('blockFieldSizeLimit returns true for valid field sizes', async () => {
		expect.assertions(1)
		let result = blockFieldSizeLimit(block)
		
		expect(result).toEqual(true) 
	})

	it('block_verifyWeaveSize returns true for valid block weave size', async () => {
		expect.assertions(1)
		let result = block_verifyWeaveSize(block, prevBlock, block.txs)
		
		expect(result).toEqual(true) 
	})

	it('block_verifyBlockHashListMerkle returns true/false for valid/invalid block index root hash', async () => {
		expect.assertions(2)
		let good = await block_verifyBlockHashListMerkle(block, prevBlock, blockIndex)
		
		expect(good).toEqual(true) 

		//now mix the blocks up to get invalid blockIndex root hash
		let bad = await block_verifyBlockHashListMerkle(prevBlock, block, blockIndex)
		
		expect(bad).toEqual(false) 
	})

})

describe('PoA tests', () => {

	it('Poa.poaFindChallengeBlock returns a valid block depth', async () => {
		expect.assertions(2)
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

describe('Difficulty tests', () => {

	it('Difficulty. retarget_ValidateDiff Validate that a new block has an appropriate difficulty.', async () =>{
		expect.assertions(2)
		let retarget = retarget_validateDiff(block, prevBlock)
		let noRetarget = retarget_validateDiff(prevBlock, prevPrevBlock)

		expect(retarget).toEqual(true)
		expect(noRetarget).toEqual(true)

	}, 20000)

})

describe('Tx (Transaction) tests', () => {

	it('Tx. Checks that verify function works for v1 format txs', async () =>{
		expect.assertions(1)
		let v1Tx = await Tx.getByIdString('2ge-rXTTFeMjVEOkb2r3X1ZooyEH4foRI98CbvcimsQ')
		let verify1 = await v1Tx.verifySignature()

		expect(verify1).toEqual(true)
	}, 20000)

	it('Tx. Checks that verify function works for v2 format txs', async () =>{
		expect.assertions(1)
		let v2Tx = await Tx.getByIdString('B3cc0u87v0SwAkTWzHu1v3Sl2vpm1cXgRGPLjtGQJvI')
		let verify2 = await v2Tx.verifySignature()

		expect(verify2).toEqual(true)
	}, 20000)

})

