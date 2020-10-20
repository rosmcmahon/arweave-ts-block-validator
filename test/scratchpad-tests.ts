import Arweave from 'arweave'
import { HOST_SERVER, BLOCK_TX_COUNT_LIMIT, BLOCK_TX_DATA_SIZE_LIMIT } from '../src/constants';
import { Block } from '../src/classes/Block';
import { BlockDTO, BlockIndexDTO, BlockTxsPairs } from '../src/types';
import { validateBlockTxs } from '../src/blockTxsValidation';
import { Tx } from '../src/classes/Tx';
import { WalletsObject, createWalletsFromDTO } from '../src/classes/WalletsObject';
import ArCache from 'arweave-cacher';
import { randomxHash } from '../src/hashing/randomx';
import col from 'ansi-colors'

const arweave = Arweave.init({
	host: 'arweave.net',
	protocol: 'https',
})

// test convenience utilities
const PASS = col.green('PASS')
const FAIL = col.red('FAIL')
const printTest = (b: boolean) => b ? console.log(PASS) : console.log(FAIL)

const main = async () => {

	// let blockDtos: BlockDTO[]
	// let block: Block
	// let prevBlock: Block
	// let blockIndex: BlockIndexDTO 
	// let prevBlockWallets: WalletsObject
	// let blockTxsPairs: BlockTxsPairs

	// let V1DATA_IDSTRING = 'eIcAGwqFCHek3EvpiRXdsESZAPKLXJMzco-7lWm4yO4'
	// let BLOCKID_HEIGHT_510000 = "RqCpcr175Xa3glLP7p-NOOw3h8_NZNaJbgqi29myyotpwuT_q83uBdbI9QutIk_i"

	// console.log("Preparing test data...")

	// try{
		
	// 	/* Prepare data requests */

	// 	let promises = []
	// 	let height = 520919 // 89 txs including large v1 data tx: eIcAGwqFCHek3EvpiRXdsESZAPKLXJMzco-7lWm4yO4

	// 	// block index
	// 	// promises.push( axios.get(
	// 	// 	HOST_SERVER+'/block/height/'+(height-1).toString()+'/hash_list', 
	// 	// 	{ headers: { "X-Block-Format": "3" } }) 
	// 	// )

	// 	// // wallet List
	// 	promises.push( ArCache.getWalletList(height - 1) ) 

	// 	// block DTOs for test block, plus previous 50 blocks
	// 	for (let i = 0; i < 51; i++) { //plus the one we are working on
	// 		promises.push( ArCache.getBlockDtoByHeight(height) )
	// 		height--
	// 	}

	// 	// /* Retrieve the data */

	// 	const [/*bIndex,*/ walletList , ...responses] = await Promise.all( promises )  

	// 	/* Process fetched data */

	// 	// blockIndex = bIndex.data // *********** NOT FOR HERE!! ********************
	// 	prevBlockWallets = createWalletsFromDTO(walletList)
	// 	Object.freeze(prevBlockWallets) 
	// 	blockDtos = responses
	// 	block = await Block.createFromDTO(blockDtos[0]) // This fetches txs also
	// 	prevBlock = await Block.createFromDTO(blockDtos[1])

	// 	// process previous 50 blocks into a BlockTxsPairs object.
	// 	blockTxsPairs = {}
	// 	for (let i = 1; i < blockDtos.length; i++) { // do not include the one we are validating
	// 		const dto = blockDtos[i];
	// 		blockTxsPairs[dto.indep_hash] = dto.txs
	// 	}
	
	// }catch(e){
	// 	console.log(FAIL, 'Error! Could not retrieve test data!', e.toString())
	// 	process.exit(1)
	// }

	// console.log("Test data ready!")
	// console.log("prevBlockWallets numkeys", Object.keys(prevBlockWallets).length )
	// console.log("prevBlock.height", prevBlock.height )


	// //////////////////////////////////////////////////////////////////////////////////////




}
main();