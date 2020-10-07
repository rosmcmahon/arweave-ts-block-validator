import ArCache from 'arweave-cacher'
import Arweave from 'arweave'
import { Block, createWalletsFromDTO, WalletsObject } from './classes'
import { BlockDTO, BlockIndexDTO, BlockTxsPairs } from './types'
import { HOST_SERVER } from './constants'
import { validateBlock } from './blockValidation'
import { updateWalletsWithBlockTxs } from './wallets-utils'


const initData = async (height: number) => {
	
	/* Initialise promises */

	let promises = []
	ArCache.setHostServer(HOST_SERVER)
	ArCache.setDebugMessagesOn(true)

	// block index. (N.B. tuples header unavailable on arweave.net)
	promises.push( ArCache.getBlockIndex(height-1) )

	// wallet List for previous block. Older lists not always available from nodes as they get cleared to save space
	promises.push( ArCache.getWalletList(height - 1) ) 

	// block DTOs for 1 test block + previous 50 blocks
	let h = height
	for (let i = 0; i < 51; i++) { 
		promises.push(ArCache.getBlockDtoByHeight(h))
		h--
	}

	/* Retrieve the data. We are using ArCache to check for cached data before fetching from HOST_SERVER */

	const [bIndex, walletList , ...responses] = await Promise.all( promises )  //this an expensive line

	/* Process initial data */

	let blockIndex: BlockIndexDTO = bIndex
	if(!blockIndex[0].hash){
		throw new Error('Error! Incorrect BlockIndex format, blockIndex[0] = ' + JSON.stringify(blockIndex[0]) )
	}

	let prevWallets: WalletsObject = createWalletsFromDTO(walletList)
	let blockDtos: BlockDTO[] = responses

	let blockTxsPairs: BlockTxsPairs = {}
	for (let i = 1; i < blockDtos.length; i++) {
		const dto = blockDtos[i];
		blockTxsPairs[dto.indep_hash] = dto.txs
	}

	return {
		blockDtos,
		blockIndex,
		prevWallets,
		blockTxsPairs
	}
}

/**
 * This is the main entry-point for the poller
 */
const main = async () => {
	let height = await ArCache.getCurrentHeight() - 100 // we will start back a bit

	let {blockDtos, blockIndex, prevWallets, blockTxsPairs} = await initData(height)

	while(true){

		let [block, prevBlock] = await Promise.all([
			Block.createFromDTO(blockDtos[0]),
			Block.createFromDTO(blockDtos[1])
		])

		console.log(`Validating new height ${block.height}...`)

		let result = await validateBlock(
			block,
			prevBlock,
			blockIndex,
			prevWallets,
			blockTxsPairs
		)

		if(result.value){
			console.log('✔️  Block validation passed: ' + result.message)
		}else{
			console.log('⛔  Block validation failed: ' + result.message)
		}

		// print some stats, make it look like we're doing something
		console.log('New block info:')
		console.log('Height\t\t', block.height)
		console.log('Indep_hash\t', Arweave.utils.bufferTob64Url(block.indep_hash))
		console.log('Numer of Txs\t', block.txs.length)
		console.log('Timestamp\t', new Date(Number(block.timestamp)*1000).toLocaleString())
		console.log(`New Weave Data\t ${(block.block_size) / (1024n ** 2n)} MB`)
		console.log(`New Weave Size\t ${block.weave_size / (1024n ** 3n)} GB`)

		// Next!

		//apply txs to WalletsObject
		await updateWalletsWithBlockTxs(block, prevWallets, prevBlock.reward_pool, prevBlock.height)

		//wait for new block
		height++
		let newBlockDto = await pollForNewBlock(height) // might take a few minutes

		let extraBlock = blockDtos[blockDtos.length - 1]
		//update blockTxsPairs
		delete blockTxsPairs[extraBlock.indep_hash]
		blockTxsPairs[blockDtos[0].indep_hash] = blockDtos[0].txs
		//update blockIndex
		blockIndex = [
			{tx_root: blockDtos[0].tx_root, weave_size: blockDtos[0].weave_size.toString(), hash: blockDtos[0].indep_hash},
			...blockIndex
		]
		//remove 51st block and add new block to start of blockDtos
		blockDtos.pop()
		blockDtos = [newBlockDto, ...blockDtos]



	}// infinite loop
}
main();


const pollForNewBlock =  async (height: number) => {
	// sleep timer one-liner
	const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

	while(true){
		let h = await ArCache.getCurrentHeight()
		console.log('...timer got height ', h)
		if(h >= height){
			return await ArCache.getBlockDtoByHeight(height)
		}
		await sleep(30000)
	}
}

