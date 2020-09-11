import axios from 'axios'
import { HOST_SERVER, BLOCK_TX_COUNT_LIMIT, BLOCK_TX_DATA_SIZE_LIMIT } from '../src/constants';
import { Block } from '../src/Block';
import { Wallet_List, BlockDTO, BlockIndexTuple, BlockTxsPairs } from '../src/types';
import { ar_tx_replay_pool__verify_block_txs } from '../src/tx-replay-pool';
import { Tx } from 'src/Tx';
import { wallet_jwkToAddressString } from 'src/Wallet';

const PASS = "\x1b[32mPASS\x1b[0m"
const FAIL = "\x1b[31mFAIL\x1b[0m"

const printTest = (b: boolean) => b ? console.log(PASS) : console.log(FAIL)

const main = async () => {

	/**
	 * Need to gather a lot of test data to verify block txs:
	 * - The block we are working on, and previous block
	 * - 3-tuple Block Index
	 * - WalletList from the previous block
	 * - Previous 50 blocks to create BlockTxPairs - we need txids from these
	 */

	let blockDtos: BlockDTO[]
	let block: Block
	let prevBlock: Block
	let blockIndex: BlockIndexTuple[]  //for PoA and full test
	let prevBlockWalletList: Wallet_List[]
	let blockTxsPairs: BlockTxsPairs

	let V1DATA_IDSTRING = 'eIcAGwqFCHek3EvpiRXdsESZAPKLXJMzco-7lWm4yO4'

	console.log("Preparing test data...")

	try{
		
		/* Prepare data requests */

		let promises = []
		// let height = Number((await axios.get(HOST_SERVER+'/info')).data.height)
		let height = 520919 // 89 txs including large v1 data tx: eIcAGwqFCHek3EvpiRXdsESZAPKLXJMzco-7lWm4yO4

		// block index
		promises.push( axios.get(
			HOST_SERVER+'/block/height/'+(height-1).toString()+'/hash_list', 
			{ headers: { "X-Block-Format": "3" } }) //unavailable on arweave.net
		)

		// wallet List
		promises.push( axios.get(HOST_SERVER+'/block/height/'+(height-1).toString()+'/wallet_list') ) 

		// block DTOs for test block, plus previous 50 blocks
		for (let i = 0; i < 51; i++) { //plus the one we are working on
			promises.push( axios.get(HOST_SERVER+'/block/height/'+height.toString()) )
			height--
		}

		/* Retrieve the data */

		const [bIndex, wallets , ...responses] = await Promise.all( promises )  // *** this an expensive line!!! ***

		/* Process fetched data */

		blockIndex = bIndex.data // *********** NOT FOR HERE!! ********************
		prevBlockWalletList = wallets.data
		blockDtos = responses.map(res=>res.data)
		block = await Block.createFromDTO(blockDtos[0]) // This fetches txs also
		prevBlock = await Block.createFromDTO(blockDtos[1])

		// process previous 50 blocks into a BlockTxsPairs object.
		blockTxsPairs = {}
		for (let i = 1; i < blockDtos.length; i++) { // do not include the one we are validating
			const dto = blockDtos[i];
			blockTxsPairs[dto.indep_hash] = dto.txs
		}
	
	}catch(e){
		console.debug('Error! Could not retrieve test data!', e.code)
	}

	console.log("Test data ready!")
	console.log("prevBlockWalletList.length", prevBlockWalletList.length )
	console.log("blockIndex.length (unused here)", blockIndex.length )
	console.log("prevBlock.height", prevBlock.height )

	// !!!!!!!!!!!!! update the wallet_list from array to object, its a pain in the arse !!!!!!!!!!!!!!!
	// "overspend in tx UmE3zdrZIykfY_iY-fUU90Hcrf8XaKy3mtnk6mCLsH4"
	// this tx cleans out the particular wallet leaving 0 AR, so our calc'd txCost must be over the actual price

	//////////////////////////////////////////////////////////////////////////////////////
	console.log()
	console.log("Validate txs. Returns true when valid data given")
	
	let result = await ar_tx_replay_pool__verify_block_txs(
		block.txs, 
		block.diff, 
		prevBlock.height, 
		block.timestamp, 
		prevBlockWalletList, 
		blockTxsPairs // this does not get height checked. assumed to be correct 50 blocks input data
	)
	if(result === true){
		console.log(PASS, "ar_tx_replay_pool__verify_block_txs returned true")
	}else{
		console.log(FAIL, "Received block with invalid txs")
	}

	//////////////////////////////////////////////////////////////////////////////////////
	console.log()
	console.log("Validate txs. Returns false when BLOCK_TX_COUNT_LIMIT exceeded")

	let bigArray = new Array(BLOCK_TX_COUNT_LIMIT + 1) //simulating too many txs

	let badTxsCount = await ar_tx_replay_pool__verify_block_txs(
		bigArray, 
		block.diff, 
		prevBlock.height, 
		block.timestamp, 
		prevBlockWalletList, 
		blockTxsPairs 
	)
	printTest(badTxsCount === false)

	//////////////////////////////////////////////////////////////////////////////////////
	console.log()
	console.log("Validate txs. Returns false when BLOCK_TX_DATA_SIZE_LIMIT exceeded")

	let badSizeTxs: Tx[] = Object.assign([], block.txs)
	let v1DataIndex = 0
	for (let i = 0; i < block.txs.length; i++) {
		const tx = block.txs[i];
		if(tx.idString === V1DATA_IDSTRING){
			v1DataIndex = i
			break;
		}
	}
	badSizeTxs[v1DataIndex] = Object.assign({}, badSizeTxs[v1DataIndex]) // make a copy so as not to break the other tests
	badSizeTxs[v1DataIndex].data_size = BigInt(BLOCK_TX_DATA_SIZE_LIMIT + 1) //simulating too much data for 1 block

	let badTxSizeReturn = await ar_tx_replay_pool__verify_block_txs(
		badSizeTxs, 
		block.diff, 
		prevBlock.height, 
		block.timestamp, 
		prevBlockWalletList, 
		blockTxsPairs 
	)
	printTest(badTxSizeReturn === false)


}
main();