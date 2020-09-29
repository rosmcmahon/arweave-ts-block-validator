import ArCache from "arweave-cacher"
import { ReturnCode, BlockIndexDTO, BlockTxsPairs, BlockDTO } from "../src/types"
import { Block } from "../src/classes/Block"
import { HOST_SERVER } from "../src/constants"
import { validateBlock } from "../src/blockValidation"
import { WalletsObject, createWalletsFromDTO } from "../src/classes/WalletsObject"


let res: ReturnCode
let block: Block
let prevBlock: Block
let blockIndex: BlockIndexDTO  //for PoA and full test
let prevBlockWallets: WalletsObject
let blockTxsPairs: BlockTxsPairs

beforeAll(async () => {
	try{

		/* Prepare data requests */
		
		ArCache.setHostServer(HOST_SERVER)
		ArCache.setDebugMessagesOn(false)

		let height = await ArCache.getCurrentHeight() //latest height

		let promises = []

		// block index. (N.B. tuples header unavailable on arweave.net)
		promises.push( ArCache.getBlockIndex(height-1) )


		// wallet List for previous block. (Older heights not always available from nodes. arweave.net seems to keep all copies)
		promises.push( ArCache.getWalletList(height - 1) ) 

		// block DTOs for 1 test block + previous 50 blocks
		for (let i = 0; i < 51; i++) { 
			promises.push(ArCache.getBlockDtoByHeight(height))
			height--
		}
		
		/* Retrieve the data */

		const [bIndex, walletList , ...responses] = await Promise.all( promises )  //this an expensive line

		/* Process fetched data */

		blockIndex = bIndex

		if(!blockIndex[0].hash){
			throw new Error('Error! Incorrect BlockIndex format, blockIndex[0] = ' + JSON.stringify(blockIndex[0]) )
		} 


		prevBlockWallets = createWalletsFromDTO(walletList)
		
		let blockDtos: BlockDTO[] = responses
		block = await Block.createFromDTO(blockDtos[0]) // This fetches txs also
		prevBlock = await Block.createFromDTO(blockDtos[1])

		// process previous 50 blocks into a BlockTxsPairs object.
		blockTxsPairs = {}
		for (let i = 1; i < blockDtos.length; i++) { // do not include the one we are validating
			const dto = blockDtos[i];
			blockTxsPairs[dto.indep_hash] = dto.txs
		}



	}catch(e){
		console.log(JSON.stringify(e))
		console.log('Network error! Could not retrieve tests data!', e.code)
		// process.exit(1)
	}

}, 60000)




describe('blockValidation completes e2e validation testing', ()=> {

	it('validateBlock should return true when given valid block & weave state data', async () => {
		expect.assertions(1)
		res = await validateBlock(block, prevBlock, blockIndex, prevBlockWallets, blockTxsPairs)
			
		expect(res).toEqual({value: true, message:"Block validation OK"})
	}, 20000)

})