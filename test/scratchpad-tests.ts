import Arweave from 'arweave'
import { HOST_SERVER, BLOCK_TX_COUNT_LIMIT, BLOCK_TX_DATA_SIZE_LIMIT } from '../src/constants';
import { Block } from '../src/classes/Block';
import { BlockDTO, BlockIndexDTO, BlockTxsPairs } from '../src/types';
import { validateBlockTxs } from '../src/blockTxsValidation';
import { Tx } from '../src/classes/Tx';
import { WalletsObject, createWalletsFromDTO } from '../src/classes/WalletsObject';
import ArCache from 'arweave-cacher';

const arweave = Arweave.init({})

// test convenience utilities
const PASS = "\x1b[32mPASS\x1b[0m"
const FAIL = "\x1b[31mFAIL\x1b[0m"
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
	// console.log('ar_tx_replay_pool__verify_block_txs tests')
	// console.log()
	// console.log("Validate txs. Returns true when valid data given")
	
	// let result = await validateBlockTxs(
	// 	block.txs, 
	// 	block.diff, 
	// 	prevBlock.height, 
	// 	block.timestamp, 
	// 	prevBlockWallets, 
	// 	blockTxsPairs // this does not get height checked. assumed to be correct 50 blocks input data
	// )
	// if(result.value === true){
	// 	console.log(PASS, "ar_tx_replay_pool__verify_block_txs returned true")
	// }else{
	// 	console.log(FAIL, "Received block with invalid txs")
	// }


	let tx1 = new Tx(await ArCache.getTxDto('pxbF_ZwpXkjAPjd9F4YhLf8Y8fdlbIGz6UhfnswSp2Q')) //v1
	printTest(await tx1.verify())
	let tx2 = new Tx(await ArCache.getTxDto('pYl1wofBvMrXg68WR4kcvOj0mGj8Y3qmoLOkTcb1Wxs')) //v2
	printTest(await tx2.verify())
	let tx3 = new Tx(await ArCache.getTxDto('OIUywTGmBF9DO3TbPVC4iPAv3WhM4M1fYIWiJsG2gLk')) //7TO8..
	printTest(await tx3.verify())
	let tx4 = new Tx(await ArCache.getTxDto('V8Fllbyin4By2DF4_fN501fhnj8gtDw7K6W5snCHdB8')) //7TO8..
	printTest(await tx4.verify())
	let tx5 = new Tx(await ArCache.getTxDto('a305zYpPbjaP67naskCCBi5GVyEwbiTomaTeO6ULOIo')) //7TO8..
	printTest(await tx5.verify())
	let tx6 = new Tx(await ArCache.getTxDto('TwZCU9mV8QJXPBIr08s_iKU27PZj2SVMis1L816UDso')) //7TO8..
	printTest(await tx6.verify())
	
	/**
	 * Salt needs to be removed in order for these to work!
	 * https://github.com/ArweaveTeam/arweave-js/blob/master/src/common/lib/crypto/node-driver.ts#L81
	 */


	// tx6.tags = []
	await tx6.sign(await arweave.wallets.generate())
	printTest(await tx6.verify())



}
main();