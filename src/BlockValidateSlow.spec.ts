import { BlockDTO, ReturnCode, BlockIndexTuple } from "./types"
import { STORE_BLOCKS_AROUND_CURRENT, HOST_SERVER } from './constants'
import axios from 'axios'
import { 
	validateBlockSlow, 
	generateBlockDataSegmentBase,
	generateBlockDataSegment,
	getIndepHash,
	validatePoa,
	poaFindChallengeBlock,
} from "./BlockValidateSlow"
import { Block } from "./Block"
import Arweave from "arweave"


describe('BlockValidator', () => {
  let res: ReturnCode
	let blockJson: BlockDTO
	let block: Block
	let prevBlock: Block
	let blockIndex: BlockIndexTuple[] = []

  beforeAll(async () => {
		const [bi, bj1, bj2] = await Promise.all([
			axios.get(HOST_SERVER+'/hash_list', { // any random node
				headers: { "X-Block-Format": "3" }  // need to set this header to get tuples
			}),
			axios.get(HOST_SERVER+'/block/height/509850'),
			axios.get(HOST_SERVER+'/block/height/509849'),
		])
		blockIndex = bi.data
		blockJson = bj1.data
		block = new Block(blockJson)
		prevBlock = new Block(bj2.data)
  }, 60000)
	
	it('generateBlockDataSegmentBase returns a valid BSDBase hash', async () => {
		expect(1)
		let hash = await generateBlockDataSegmentBase(block)
		let data = Arweave.utils.bufferTob64Url(hash)
		
		expect(data).toEqual("dOljnXSULT9pTX4wiagcUOqrZZjBWLwKBR3Aoe3-HhNAW_CiKHNsrvqwL14x6BMm") 
		//BDSBase for /height/509850 hash/si5OoWK-OcYt3LOEDCP2V4SWuj5X5n1LdoTh09-DtOppz_VkE72Cb0DCvygYMbW5
	}, 20000)

	it('generateBlockDataSegment returns a valid BSD hash', async () => {
		expect(1)
		let hash = await generateBlockDataSegment(block)
		let data = Arweave.utils.bufferTob64Url(hash)

		expect(data).toEqual("uLdZH6FVM-TI_KiA8oZCGbqXwknwyg69ur7KPrSMVPcBljPnIzeOhnPRPyOoifWV") 
		//BDSBase for /height/509850 hash/si5OoWK-OcYt3LOEDCP2V4SWuj5X5n1LdoTh09-DtOppz_VkE72Cb0DCvygYMbW5
	}, 20000)

	it('getIndepHash returns a valid hash', async () => {
		expect(1)
		let hash: any = await getIndepHash(block)
		
		expect(new Uint8Array(hash)).toEqual(block.indep_hash) 
	}, 20000)

	it('poaFindChallengeBlock returns a valid block depth', async () => {
		let testByte =  500000n

		const {txRoot, blockBase, blockTop, bh} = poaFindChallengeBlock(testByte, blockIndex)

		expect(testByte).toBeGreaterThan(blockBase) 
		expect(testByte).toBeLessThanOrEqual(blockTop) 
	}, 20000)

	it('validatePoa returns true/false for valid/invalid Poa', async () => {
		expect(2)
		let good = await validatePoa(prevBlock.indep_hash, prevBlock.weave_size, blockIndex, block.poa) 
		let badPoa = prevBlock.poa
		let bad = await validatePoa(prevBlock.indep_hash, prevBlock.weave_size, blockIndex, badPoa)

		expect(good).toEqual(true) 
		expect(bad).toEqual(false) 
	}, 20000)

	it('validateBlockSlow should return true when given valid blocks', async () => {
		expect(1)
		res = await validateBlockSlow(block, prevBlock, blockIndex)
			
		expect(res).toEqual({code:200, message:"Block slow check OK"})
	}, 20000)

})