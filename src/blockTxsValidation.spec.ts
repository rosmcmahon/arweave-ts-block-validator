import axios from "axios"
import { validateBlockTxs } from "./blockTxsValidation"
import { Block } from "./classes/Block"
import { Tx } from "./classes/Tx"
import { createWalletsFromDTO, WalletsObject } from "./classes/WalletsObject"
import { BLOCK_TX_COUNT_LIMIT, BLOCK_TX_DATA_SIZE_LIMIT, HOST_SERVER } from "./constants"
import { BlockDTO, BlockIndexTuple, BlockTxsPairs } from "./types"



	/**
	 * Need to gather a lot of test data to verify block txs:
	 * - The block we are working on, and previous block
	 * - WalletList from the previous block
	 * - Previous 50 blocks to create BlockTxPairs - we need txids from these
	 */

	/* Declare inputs data */

	let blockDtos: BlockDTO[]
	let block: Block
	let prevBlock: Block
	let prevBlockWallets: WalletsObject
	let blockTxsPairs: BlockTxsPairs

	// picking this block to work on as it has a selection of v1 & v2 txs (some blocks have zero txs)
	let height = 520919 // 89 txs including large v1 data tx: eIcAGwqFCHek3EvpiRXdsESZAPKLXJMzco-7lWm4yO4
	let V1DATA_IDSTRING = 'eIcAGwqFCHek3EvpiRXdsESZAPKLXJMzco-7lWm4yO4'
	let BLOCKID_HEIGHT_510000 = "RqCpcr175Xa3glLP7p-NOOw3h8_NZNaJbgqi29myyotpwuT_q83uBdbI9QutIk_i" //out of scope blockid

	beforeAll(async () => {
		try{
		
			/* Prepare data requests */
	
			let promises = []
	
			// wallet List
			promises.push( axios.get(HOST_SERVER + '/block/height/' + (height-1).toString() + '/wallet_list') ) 
	
			// block DTOs for test block + previous 50 blocks
			for (let i = 0; i < 51; i++) { 
				promises.push(axios.get( HOST_SERVER + '/block/height/' + height.toString() ))
				height--
			}
	
			/* Retrieve the data */
	
			const [walletList , ...responses] = await Promise.all( promises )  //this an expensive line
	
			/* Process fetched data */
	
			prevBlockWallets = createWalletsFromDTO(walletList.data)
			Object.freeze(prevBlockWallets) 
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
			console.log('\x1b[31mERROR!\x1b[0m', 'Could not retrieve test data!', e.code)
		}

	}, 60000)

	describe('Block Txs Validation tests', () => {

		it('Validate txs. Returns true when valid data given', async() => {
			expect.assertions(1)

			let result = await validateBlockTxs(
				block.txs, 
				block.diff, 
				prevBlock.height, 
				block.timestamp, 
				prevBlockWallets, 
				blockTxsPairs // this does not get height checked. assumed to be correct 50 blocks input data
			)

			expect(result).toEqual(true)
		})

		it('Validate txs. Returns false when BLOCK_TX_COUNT_LIMIT exceeded', async() => {
			expect.assertions(1)

			let bigArray = new Array(BLOCK_TX_COUNT_LIMIT + 1) //simulating too many txs

			let badTxsCount = await validateBlockTxs(
				bigArray, 
				block.diff, 
				prevBlock.height, 
				block.timestamp, 
				prevBlockWallets, 
				blockTxsPairs // this does not get height checked. assumed to be correct 50 blocks input data
			)

			expect(badTxsCount).toEqual(false)
		})

		it('Validate txs. Returns false when BLOCK_TX_DATA_SIZE_LIMIT exceeded', async() => {
			expect.assertions(1)

			// N.B this test needs a v1 tx to alter the data size, in the example we use 520919 & V1DATA_IDSTRING

			let badSizeTxs: Tx[] = Object.assign([], block.txs)
			let v1DataIndex = 0
			for (let i = 0; i < block.txs.length; i++) {
				const tx = block.txs[i];
				if(tx.idString === V1DATA_IDSTRING){
					v1DataIndex = i
					break;
				}
			}
			// make a copy so as not to break the other tests
			badSizeTxs[v1DataIndex] = Object.assign({}, badSizeTxs[v1DataIndex]) 
			//simulating too much data for 1 block
			badSizeTxs[v1DataIndex].data_size = BigInt(BLOCK_TX_DATA_SIZE_LIMIT + 1) 

			let badTxSizeReturn = await validateBlockTxs(
				badSizeTxs, 
				block.diff, 
				prevBlock.height, 
				block.timestamp, 
				prevBlockWallets, 
				blockTxsPairs 
			)
			
			expect(badTxSizeReturn).toEqual(false)
		})



	})