import axios from 'axios'
import { HOST_SERVER } from '../src/constants';
import { Block } from '../src/Block';
import { Wallet_List, BlockDTO, BlockIndexTuple, BlockTxsPairs } from '../src/types';
import { ar_tx_replay_pool__verify_block_txs } from '../src/tx-replay-pool';

const PASS = "\x1b[32mPASS:\x1b[0m"
const FAIL = "\x1b[31mFAIL:\x1b[0m"

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

	console.log("Preparing test data...")

	try{
		
		/* Prepare data requests */

		let promises = []
		let height = Number((await axios.get(HOST_SERVER+'/info')).data.height)

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

	
	let result = await ar_tx_replay_pool__verify_block_txs(
		block.txs, 
		block.diff, 
		prevBlock.height, 
		block.timestamp, 
		prevBlockWalletList, 
		blockTxsPairs // this does not get height checked. assumed correct input data
	)
	if( !result ){
		console.log(FAIL, "Received block with invalid txs")
		return false
	}

	console.log(PASS, "ar_tx_replay_pool__verify_block_txs returned true")

	

}
main();