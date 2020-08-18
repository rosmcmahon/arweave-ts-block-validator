import { BlockDTO, ReturnCode } from "./types"
import { STORE_BLOCKS_AROUND_CURRENT } from './constants'
import axios from 'axios'
import { validateBlockQuick, validateBlockJson, validateBlockSlow, generateBlockDataSegmentBase } from "./BlockValidator"
import { Block } from "./Block"


describe('BlockValidator', () => {
	let blockJson: BlockDTO
	let block: Block
  let res: ReturnCode

  beforeEach(async () => {
    blockJson = (await axios.get('https://arweave.net/block/height/506359')).data
		// blockJson = (await axios.get('https://arweave.net/block/current')).data
		block = new Block(blockJson)
  })

  it('validateBlockJson should return true for a valid block', async () => {
    expect(1)
		res = validateBlockJson(blockJson, blockJson.height-1 )
		
    expect(res).toEqual({code: 200, message: "Block quick check OK"})
  })

  it('validateBlockQuick should return false for an out of range height', async () => {
    let ahead = validateBlockJson( blockJson, blockJson.height-(STORE_BLOCKS_AROUND_CURRENT+10) )
		expect(ahead).toEqual({code: 400, message: "Height is too far ahead"})
		
    let behind = validateBlockJson( blockJson, blockJson.height+(STORE_BLOCKS_AROUND_CURRENT+10) )
    expect(behind).toEqual({code: 400, message: "Height is too far behind"})
	})
	
	it('validateBlockQuick should return false for difficulty too low', async () => {
		expect(1)
		let test = Object.assign({},blockJson)
		test.diff = "-100"                                                    //!! TODO: what are good/bad difficulties?
    res = validateBlockJson(test, blockJson.height-1 )
    expect(res).toEqual({code: 400, message: "Difficulty too low"})
	})
	
	it('generateBlockDataSegmentBase reurns a BSDBase hash', async () => {
		expect(1)
		let hash = await generateBlockDataSegmentBase(block)
		expect(hash).toEqual("check test output")
	})

	// it('validateBlockSlow should return true when given valid blocks', async () => {
	// 	expect(2)
	// 	let block = await Block.getByHeight(506359)
	// 	let prevBlock = await Block.getByHeight(506358)
	// 	res = await validateBlockSlow(block, prevBlock)

	// 	expect(res).toEqual({code:200, message:"Block slow check OK"})
	// })

})