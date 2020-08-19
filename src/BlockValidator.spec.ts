import { BlockDTO, ReturnCode } from "./types"
import { STORE_BLOCKS_AROUND_CURRENT } from './constants'
import axios from 'axios'
import { 
	validateBlockJson, 
	validateBlockQuick, 
	validateBlockSlow, 
	generateBlockDataSegmentBase,
	generateBlockDataSegment,
} from "./BlockValidator"
import { Block } from "./Block"
import Arweave from "arweave"


describe('BlockValidator', () => {
	let blockJson: BlockDTO
	let block: Block
  let res: ReturnCode

  beforeEach(async () => {
    blockJson = (await axios.get('https://arweave.net/block/height/509850')).data
		// blockJson = (await axios.get('https://arweave.net/block/current')).data
		block = new Block(blockJson)
  })

  it('validateBlockJson should return true for a valid block', async () => {
    expect(1)
		res = validateBlockJson(blockJson, blockJson.height-1 )
		
    expect(res).toEqual({code: 200, message: "Block quick check OK"})
  }, 20000)

  it('validateBlockQuick should return false for an out of range height', async () => {
    let ahead = validateBlockQuick( block, block.height - (STORE_BLOCKS_AROUND_CURRENT+10) )
		expect(ahead).toEqual({code: 400, message: "Height is too far ahead"})
		
    let behind = validateBlockQuick( block, block.height + (STORE_BLOCKS_AROUND_CURRENT+10) )
    expect(behind).toEqual({code: 400, message: "Height is too far behind"})
	})
	
	it('validateBlockQuick should return false for difficulty too low', async () => {
		expect(1)
		let test = Object.assign({},block)
		test.diff = "-100"                                                    //!! TODO: what are good/bad difficulties?
    res = validateBlockQuick(test, block.height-1 )
    expect(res).toEqual({code: 400, message: "Difficulty too low"})
	})
	
	it('generateBlockDataSegmentBase returns a BSDBase hash', async () => {
		expect(1)
		let hash = await generateBlockDataSegmentBase(block)
		let data = Arweave.utils.bufferTob64Url(hash)
		
		expect(data).toEqual("dOljnXSULT9pTX4wiagcUOqrZZjBWLwKBR3Aoe3-HhNAW_CiKHNsrvqwL14x6BMm") 
		//BDSBase for /height/509850 hash/si5OoWK-OcYt3LOEDCP2V4SWuj5X5n1LdoTh09-DtOppz_VkE72Cb0DCvygYMbW5
	}, 20000)

	it('generateBlockDataSegment returns a BSD hash', async () => {
		expect(1)
		let hash = await generateBlockDataSegment(block)
		let data = Arweave.utils.bufferTob64Url(hash)

		expect(data).toEqual("uLdZH6FVM-TI_KiA8oZCGbqXwknwyg69ur7KPrSMVPcBljPnIzeOhnPRPyOoifWV") 
		//BDSBase for /height/509850 hash/si5OoWK-OcYt3LOEDCP2V4SWuj5X5n1LdoTh09-DtOppz_VkE72Cb0DCvygYMbW5
	}, 20000)

	// it('validateBlockSlow should return true when given valid blocks', async () => {
	// 	expect(2)
	// 	let block = await Block.getByHeight(506359)
	// 	let prevBlock = await Block.getByHeight(506358)
	// 	res = await validateBlockSlow(block, prevBlock)

	// 	expect(res).toEqual({code:200, message:"Block slow check OK"})
	// })

})