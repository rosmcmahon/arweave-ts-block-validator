import { BlockDTO, ReturnCode, BlockIndexTuple } from "./types"
import { STORE_BLOCKS_AROUND_CURRENT, HOST_SERVER } from './constants'
import axios from 'axios'
import { 
	validateBlockJson, 
	validateBlockQuick, 
} from "./BlockValidateQuick"
import { Block } from "./Block"


describe('BlockValidator', () => {
  let res: ReturnCode
	let blockJson: BlockDTO
	let block: Block
	let prevBlock: Block

  beforeAll(async () => {
		const [bj1, bj2] = await Promise.all([
			axios.get(HOST_SERVER+'/block/height/509850'),
			axios.get(HOST_SERVER+'/block/height/509849'),
		])
		blockJson = bj1.data
		block = new Block(blockJson)
		prevBlock = new Block(bj2.data)
  }, 20000)

  it('validateBlockJson should return true for a valid block', async () => {
    expect(1)
		res = validateBlockJson(blockJson, blockJson.height-1 )
		
    expect(res).toEqual({code: 200, message: "Block quick check OK"})
  })

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

})