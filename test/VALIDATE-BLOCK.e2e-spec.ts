import axios from "axios"
import { ReturnCode, BlockIndexTuple } from "../src/types"
import { Block } from "../src/classes/Block"
import { HOST_SERVER, RETARGET_BLOCKS } from "../src/constants"
import { validateBlock } from "../src/blockValidation"
import { WalletsObject, createWalletsFromDTO } from "../src/classes/WalletsObject"



let res: ReturnCode
let block: Block
let prevBlock: Block
let blockIndex: BlockIndexTuple[]  //for PoA and full test
let prevBlockWallets: WalletsObject

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
		
		block = await Block.createFromDTO(bj1.data)
		prevBlock = await Block.createFromDTO(bj2.data)
		prevBlockWallets = createWalletsFromDTO(bj2WalletList.data)


	}catch(e){
		console.debug('Network error! Could not retrieve tests data!', e.code)
		process.exit(1)
	}

}, 60000)




describe('blockValidation completes e2e validation testing', ()=> {

	it('validateBlock should return true when given valid block & weave state data', async () => {
		expect.assertions(1)
		res = await validateBlock(block, prevBlock, blockIndex, prevBlockWallets)
			
		expect(res).toEqual({code:200, message:"Block slow check OK"})
	}, 20000)

})