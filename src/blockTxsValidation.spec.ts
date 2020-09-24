import axios from "axios"
import ArCache from 'arweave-cacher'
import { validateBlockTxs, verifyTx } from "./blockTxsValidation"
import { Block } from "./classes/Block"
import { Tx } from "./classes/Tx"
import { createWalletsFromDTO, WalletsObject } from "./classes/WalletsObject"
import { BLOCK_TX_COUNT_LIMIT, BLOCK_TX_DATA_SIZE_LIMIT, HOST_SERVER, WALLET_NEVER_SPENT } from "./constants"
import { BlockDTO, BlockTxsPairs, ReturnCode } from "./types"
import Arweave from 'arweave'
import { deserialize, serialize } from "v8"
import { JWKInterface } from "arweave/node/lib/wallet"
import { wallet_jwkToAddressString } from "./utils/wallet"

const arweave = Arweave.init({
	host: 'arweave.net', 
	port: 443, protocol: 
	'https', 
	timeout: 20000
})

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
let ret: ReturnCode
let jwk: JWKInterface
let jwkAddress: string

// picking this block to work on as it has a selection of v1 & v2 txs (some blocks have zero txs)
let height = 520919 // 89 txs including large v1 data tx: eIcAGwqFCHek3EvpiRXdsESZAPKLXJMzco-7lWm4yO4
const V1DATA_IDSTRING = 'eIcAGwqFCHek3EvpiRXdsESZAPKLXJMzco-7lWm4yO4'
const AR_TRANSFER_IDSTRING = 'UmE3zdrZIykfY_iY-fUU90Hcrf8XaKy3mtnk6mCLsH4'
const OUTOFSCOPE_BLOCKID_510000 = "RqCpcr175Xa3glLP7p-NOOw3h8_NZNaJbgqi29myyotpwuT_q83uBdbI9QutIk_i" //out of scope blockid, height 510000
const OUTOFSCOPE_TXID_510000 = "gbU39n24hIxv05sBvVyGtEWflSiooqK_VnjB9HSWATo" //out of scope txid[0] from height 510000


beforeAll(async () => {
	try{
	
		/* Prepare data requests */

		let promises = []
		ArCache.setHostServer(HOST_SERVER)
		ArCache.setDebugMessagesOn(false)

		// wallet List
		// promises.push( axios.get(HOST_SERVER + '/block/height/' + (height-1).toString() + '/wallet_list') ) 
		promises.push( ArCache.getWalletList(height - 1))

		// block DTOs for test block + previous 50 blocks
		for (let i = 0; i < 51; i++) { 
			// promises.push(axios.get( HOST_SERVER + '/block/height/' + height.toString() ))
			promises.push( ArCache.getBlockDtoByHeight(height) )
			height--
		}

		/* Retrieve the data */
		
		const [walletList , ...responses] = await Promise.all( promises ) 
		
		/* Process fetched data */
		
		prevBlockWallets = createWalletsFromDTO(walletList)
		
		blockDtos = responses
		block = await Block.createFromDTO(blockDtos[0]) // This fetches txs also
		prevBlock = await Block.createFromDTO(blockDtos[1])

		// process previous 50 blocks into a BlockTxsPairs object.
		blockTxsPairs = {}
		for (let i = 1; i < blockDtos.length; i++) { // do not include the one we are validating
			const dto = blockDtos[i];
			blockTxsPairs[dto.indep_hash] = dto.txs
		}


		// create a fake testing wallet, with an entry in the WalletsObject, and give it some balance
		jwk = await arweave.wallets.generate()
		jwkAddress = await wallet_jwkToAddressString(jwk)
		prevBlockWallets[jwkAddress] = {balance: 1000n, last_tx: WALLET_NEVER_SPENT}

		Object.freeze(prevBlockWallets) 
	
	}catch(e){
		console.log('\x1b[31mERROR!\x1b[0m', 'Could not retrieve test data!', e.code)
		process.exit(1)
	}

}, 60000)

describe('Block Txs Validation tests', () => {

	it('Returns true when valid data given', async() => {
		expect.assertions(1)

		let result = await validateBlockTxs(
			block.txs, 
			block.diff, 
			prevBlock.height, 
			block.timestamp, 
			prevBlockWallets, 
			blockTxsPairs // this does not get height checked. assumed to be correct 50 blocks input data
		)

		expect(result).toEqual({value: true, message: "Valid block txs"})
	})

	it('Returns false when BLOCK_TX_COUNT_LIMIT exceeded', async() => {
		expect.assertions(1)

		let bigArray = new Array(BLOCK_TX_COUNT_LIMIT + 1) //simulating too many txs

		let badTxsCount = await validateBlockTxs(
			bigArray, //<- oops!
			block.diff, 
			prevBlock.height, 
			block.timestamp, 
			prevBlockWallets, 
			blockTxsPairs // this does not get height checked. assumed to be correct 50 blocks input data
		)

		expect(badTxsCount).toEqual({value: false, message: "BLOCK_TX_COUNT_LIMIT exceeded"})
	})

	it('Returns false when BLOCK_TX_DATA_SIZE_LIMIT exceeded', async() => {
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
			badSizeTxs, //<- oops!
			block.diff, 
			prevBlock.height, 
			block.timestamp, 
			prevBlockWallets, 
			blockTxsPairs 
		)
		
		expect(badTxSizeReturn).toEqual({value: false, message: "BLOCK_TX_DATA_SIZE_LIMIT exceeded"})
	})

	it('Returns false for duplicate tx in block', async ()=> {
		expect.assertions(1)

		let dupplicateTxs = Object.assign([], block.txs)
		dupplicateTxs.push(dupplicateTxs[0]) //push first tx to the end as well

		let bad = await validateBlockTxs(
			dupplicateTxs, //<- oops!
			block.diff, 
			prevBlock.height, 
			block.timestamp, 
			prevBlockWallets, 
			blockTxsPairs 
		)

		expect(bad).toEqual({value: false, message: "tx already in verifiedTxs"})		
		
	})

	it('Returns false for duplicate tx in blockTxPairs', async ()=> {
		expect.assertions(1)

		// push a duplicate into blockTxsPairs
		let duplicateTxid = block.txs[0].idString
		let blockTxsPairsClone: BlockTxsPairs = deserialize(serialize(blockTxsPairs))
		blockTxsPairsClone[ Object.keys(blockTxsPairsClone)[0] ].push(duplicateTxid)

		let bad = await validateBlockTxs(
			block.txs, 
			block.diff, 
			prevBlock.height, 
			block.timestamp, 
			prevBlockWallets, 
			blockTxsPairsClone, //<- oops! 
		)

		expect(bad).toEqual({value: false, message: "tx already in blockTxsPairs"})		
		
	})

	it('Returns false for bad anchor not in blockTxPairs', async ()=> {
		expect.assertions(1)

		// pick a tx and give it a bad anchor 
		let blockTxsClone: Tx[] = Object.assign([], block.txs)
		let badTx = await Tx.getByIdString(blockTxsClone[0].idString) // re-download is a better clone

		badTx.last_tx = Arweave.utils.b64UrlToBuffer(OUTOFSCOPE_BLOCKID_510000) // this could be any blockid/txid not in blockTxPairs

		// let repackage that
		await badTx.sign(jwk)

		// put bad anchor tx back into txs
		blockTxsClone[0] = badTx

		let bad = await validateBlockTxs(
			blockTxsClone, //oops!
			block.diff, 
			prevBlock.height, 
			block.timestamp, 
			prevBlockWallets, 
			blockTxsPairs
		)

		expect(bad).toEqual({value: false, message: "last_tx anchor not in blockTxsPairs"})		
		
	}, 20000)
	
})

describe('Verify Tx tests', () => {

	it('Returns false for a tx with negative quantity', async () => {
		expect.assertions(1)

		// create a bad Tx with negative amount
		let badTx = await Tx.getByIdString(block.txs[0].idString)
		badTx.quantity = -1n
		await badTx.sign(jwk)
		
		let bad = await verifyTx(
			badTx,
			block.diff,
			prevBlock.height,
			block.timestamp,
			prevBlockWallets
		)

		expect(bad).toEqual({value: false, message: "tx quantity negative"})
	})

	it('Returns false for a tx with owner the same as target', async () => {
		expect.assertions(1)

		// create a bad Tx 
		let badTx = await Tx.getByIdString(AR_TRANSFER_IDSTRING) //value transfer tx

		badTx.target = jwkAddress // put to same address as signing wallet

		await badTx.sign(jwk)
		
		let bad = await verifyTx(
			badTx,
			block.diff,
			prevBlock.height,
			block.timestamp,
			prevBlockWallets
		)

		expect(bad).toEqual({value: false, message: "tx owner same as tx target"})
	})

	it('Returns false for a tx with bad signature', async () => {
		expect.assertions(1)

		// create a bad Tx 
		let badTx = await Tx.getByIdString(block.txs[0].idString)

		badTx.signature[0] ^= 0xff //mess up the signature		
		
		let bad = await verifyTx(
			badTx,
			block.diff,
			prevBlock.height,
			block.timestamp,
			prevBlockWallets
		)

		expect(bad).toEqual({value: false, message: "invalid signature or txid. Hash mismatch"})
	})

	it('Returns false for a tx when wallet does not have enough funds', async () => {
		expect.assertions(1)

		// create a bad Tx 
		let badTx = await Tx.getByIdString(AR_TRANSFER_IDSTRING) //value transfer tx

		badTx.quantity = prevBlockWallets[jwkAddress].balance + 1n  // + reward means not enoughb in jwk wallet

		await badTx.sign(jwk)
		
		let bad = await verifyTx(
			badTx,
			block.diff,
			prevBlock.height,
			block.timestamp,
			prevBlockWallets
		)

		expect(bad).toEqual({value: false, message: "overspend in tx"})
	})

	it('Returns false if tx reward too cheap', async () => {
		expect.assertions(1)

debugger;

		// create a bad Tx 
		let badTx = await Tx.getByIdString(block.txs[0].idString)

		console.log('badTx.reward',badTx.reward)

		badTx.reward = 0n //too low

		await badTx.sign(jwk)
		
		let bad = await verifyTx(
			badTx,
			block.diff,
			prevBlock.height,
			block.timestamp,
			prevBlockWallets
		)

		expect(bad).toEqual({value: false, message: "tx reward too cheap"})
	})

})


