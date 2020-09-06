import axios from "axios"
import { ReturnCode, BlockIndexTuple, Wallet_List, BlockDTO } from "../src/types"
import { Block } from "../src/Block"
import { HOST_SERVER, RETARGET_BLOCKS } from "../src/constants"
import { validateBlockQuick } from "../src/blockValidateQuick"
import { validateBlockSlow } from "../src/blockValidateSlow"



let res: ReturnCode
let blockJson: BlockDTO
let block: Block
let prevBlock: Block
let blockIndex: BlockIndexTuple[]  //for PoA and full test
let prevBlockWalletList: Wallet_List[]

beforeAll(async () => {
	try{
		const currentHeight = Number((await axios.get(HOST_SERVER+'/info')).data.height)
		//we want height % 10 so we get a difficulty retarget block
		let workingHeight = currentHeight - (currentHeight % RETARGET_BLOCKS)

		const [
			bIndex, 

			bj1, 
			bj2, 
			bj2WalletList, 
		] = await Promise.all([
			axios.get(HOST_SERVER+'/hash_list', { headers: { "X-Block-Format": "3" } }), // tuples header unavailable on arweave.net

			axios.get(HOST_SERVER+'/block/height/'+(workingHeight).toString()), 
			axios.get(HOST_SERVER+'/block/height/'+(workingHeight-1).toString()), 
			axios.get('https://arweave.net/block/height/'+(workingHeight-1).toString()+'/wallet_list'), //arweave.net keeps old
		])
		blockIndex = bIndex.data
		
		blockJson = bj1.data
		block = await Block.createFromDTO(bj1.data)
		prevBlock = await Block.createFromDTO(bj2.data)
		prevBlockWalletList = (bj2WalletList.data)


	}catch(e){
		console.debug('Network error! Could not retrieve tests data!', e.code)
		process.exit(1)
	}

}, 60000)



describe('BlockValidateQuick completes e2e Quick validation tests', ()=> {

  it('blockValidateQuick should return true for a valid block', async () => {
		let result = await validateBlockQuick(blockJson, block, block.height )
		
    expect(result).toEqual({code: 200, message: "Block quick check OK"})
  })

})

describe('blockValidateSlow completes e2e Slow validation tests', ()=> {

	it('validateBlockSlow should return true when given valid block data', async () => {
		expect.assertions(1)
		res = await validateBlockSlow(block, prevBlock, blockIndex, prevBlockWalletList)
			
		expect(res).toEqual({code:200, message:"Block slow check OK"})
	}, 20000)

})