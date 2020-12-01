import ArCache from 'arweave-cacher'
import Arweave from 'arweave'
import col from 'ansi-colors'
import { Block, createWalletsFromDTO, WalletsObject } from './classes'
import { BlockDTO, BlockIndexDTO, BlockTxsPairs } from './types'
import { HOST_SERVER } from './constants'
import { validateBlock } from './blockValidation'
import { updateWalletsWithBlockTxs } from './wallets-utils'
import fs from 'fs/promises'
import { logEntry } from './utils/logger'
import { EOL } from 'os'

const TRAIL_BEHIND = 4

const initArCacheData = async (height: number) => {
	
	/* Initialise promises */

	let promises = []

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

	console.log(col.bold('Gathering data for first block validation...'))

	ArCache.setHostServer(HOST_SERVER)
	ArCache.setDebugMessagesOn( process.env.VERBOSE === 'true' )

	let height = await ArCache.getCurrentHeight() - TRAIL_BEHIND // we will start back a bit

	logEntry('poller begins using starting height ' + height)

	let {blockDtos, blockIndex, prevWallets, blockTxsPairs} = await initArCacheData(height)

	while(true){

		let [block, prevBlock] = await Promise.all([
			Block.createFromDTO(blockDtos[0]),
			Block.createFromDTO(blockDtos[1])
		])

		// print some stats for the block validation
		console.log('Stats for candidate block:')
		console.log('height\t\t', block.height)
		console.log('indep_hash\t', Arweave.utils.bufferTob64Url(block.indep_hash))
		console.log('numer of txs\t', block.txs.length)
		console.log('timestamp\t', new Date(Number(block.timestamp)*1000).toLocaleString())
		console.log(`new Weave Data\t ${(block.block_size) / (1024n ** 2n)} MB`)
		console.log(`new Weave Size\t ${block.weave_size / (1024n ** 3n)} GB`)

		console.log(col.bold(`Validating new height ${block.height}...`))

		let result = await validateBlock(
			block,
			prevBlock,
			blockIndex,
			prevWallets,
			blockTxsPairs
		)

		if(result.value){
			console.log('✔️ ', col.bgGreen.black('Block validation passed '), result.message, block.height)

			await logEntry(block.height + ":" + result.message)
		}else{
			console.log('⛔', col.bgRed.bold('Block validation failed '), result.message, block.height)

			// log the error
			let logs =
				'Block validation failed' + EOL
				+ 'result.message:\t' + result.message + EOL
				+ 'blockDtos[0].height:\t' + blockDtos[0].height + EOL
				+ 'blockDtos[0].indep_hash:\t' + blockDtos[0].indep_hash + EOL
				+ 'blockDtos[0].previous_block:\t' + blockDtos[0].previous_block + EOL
				+ 'blockDtos[1].indep_hash:\t' + blockDtos[1].indep_hash + EOL
			await logEntry(logs)

			// recover with new data for next block
			console.log(col.bold('Gathering fresh data after a validation fail...'))

			height++
			let {blockDtos: bDtos, blockIndex: bi, prevWallets: pW, blockTxsPairs: bTPs} = await initArCacheData(height)
			blockDtos = bDtos
			blockIndex = bi
			prevWallets = pW
			blockTxsPairs = bTPs

			continue; // main while(true)
		}

		// Next block!

		console.log(col.bold('Preparing for next validation...'))

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
			{
				tx_root: blockDtos[0].tx_root, 
				weave_size: blockDtos[0].weave_size.toString(), 
				hash: blockDtos[0].indep_hash
			},
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
		let h = await ArCache.getCurrentHeight() - TRAIL_BEHIND
		console.log('...poller got height ', h)
		if(h >= height){
			return await ArCache.getBlockDtoByHeight(height)
		}

		await sleep(30000)
	}
}

