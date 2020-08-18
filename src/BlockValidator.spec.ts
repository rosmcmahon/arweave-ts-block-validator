import { BlockDTO, ReturnCode } from "./types"
import axios from 'axios'
import { validateBlockQuick, validateBlockJson, validateBlockSlow } from "./BlockValidator"
import { STORE_BLOCKS_AROUND_CURRENT } from './constants'
import { Block } from "./Block"


describe('BlockValidator', () => {
  let blockJson: BlockDTO
  let res: ReturnCode

  beforeEach(async () => {
    blockJson = (await axios.get('https://arweave.net/block/height/506359')).data
    // blockJson = (await axios.get('https://arweave.net/block/current')).data
  })

  it('should return true for a valid block', async () => {
    expect(1)
    res = validateBlockJson(blockJson, blockJson.height-1 )
    expect(res).toEqual({code: 200, message: "Block quick check OK"})
  })

  it('should return false for an out of range height', async () => {
    let ahead = validateBlockJson( blockJson, blockJson.height-(STORE_BLOCKS_AROUND_CURRENT+10) )
		expect(ahead).toEqual({code: 400, message: "Height is too far ahead"})
		
    let behind = validateBlockJson( blockJson, blockJson.height+(STORE_BLOCKS_AROUND_CURRENT+10) )
    expect(behind).toEqual({code: 400, message: "Height is too far behind"})
	})
	
	it('should return false for difficulty too low', async () => {
		expect(1)
		let test = Object.assign({},blockJson)
		test.diff = "-100"                                                    //!! TODO: what are good/bad difficulties?
    res = validateBlockJson(test, blockJson.height-1 )
    expect(res).toEqual({code: 400, message: "Difficulty too low"})
	})
	
	it('validateBlockSlow should return true when given valid blocks', async () => {
		expect(2)
		let block = await Block.getByHeight(506359)
		let prevBlock = await Block.getByHeight(506358)
		res = validateBlockSlow(block, prevBlock)
		
		expect(res).toEqual({code:200, message:"Block slow check OK"})
	})

})