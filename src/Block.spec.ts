import { Block } from './Block'
import { BlockDTO } from './types'
import Axios from 'axios'
import BigNumber from 'bignumber.js'

describe('Block', ()=>{
	let blockJson: BlockDTO
	let badBlockJson: any

	beforeEach(async () => {
		blockJson = (await Axios.get('https://arweave.net/block/current')).data
		badBlockJson = Object.assign({})
		delete badBlockJson.diff
		delete badBlockJson.height
  })

	it('should return a valid Block', async ()=>{
		let block: Block = new Block(blockJson)
		expect(block).toBeDefined()
		expect(block).toBeInstanceOf(Block)
		expect(block.diff).toBeInstanceOf(BigNumber)
	})
	// it('should not return a valid Block without a valid BlockDTO', async ()=>{
	// 	let block: any 
		
	// 		block = new Block(badBlockJson)
		
	// 	expect(block).not.toBeInstanceOf(Block)
	// })
})