import axios from 'axios'
import Arweave from "arweave"
import { Wallet_List } from './types'
import { HOST_SERVER } from './constants'
import { Block,	generateBlockDataSegmentBase, generateBlockDataSegment, getIndepHash, block_verifyTxRoot } from './Block'
import { nodeUtils_updateWallets, nodeUtils_IsWalletInvalid } from './NodeUtils'
import { wallet_ownerToAddressString } from './Wallet'


//BDSBase & BDS for /height/509850 hash/si5OoWK-OcYt3LOEDCP2V4SWuj5X5n1LdoTh09-DtOppz_VkE72Cb0DCvygYMbW5
const BDS_BASE_KNOWN_HASH = "dOljnXSULT9pTX4wiagcUOqrZZjBWLwKBR3Aoe3-HhNAW_CiKHNsrvqwL14x6BMm"
const BDS_KNOWN_HASH = "uLdZH6FVM-TI_KiA8oZCGbqXwknwyg69ur7KPrSMVPcBljPnIzeOhnPRPyOoifWV"
const HEIGHT_V1_TX = "520919" //contains eIcAGwqFCHek3EvpiRXdsESZAPKLXJMzco-7lWm4yO4 v1 data tx (6MB+, needs chunking) + random v2 txs

let blockKnownHash: Block
let prevBlockKnownHash: Block
let prevWalletList: Wallet_List[]
let v1BigV2Block: Block 


beforeAll(async () => {
	try{

		const [
			bjKnownHash, 
			bjPrevKnownHash, 
			bjPrevWalletList, 
			bjV1BigV2,
		] = await Promise.all([
			axios.get(HOST_SERVER+'/block/height/509850'), //known hash, poa option 1, has 4 txs
			axios.get(HOST_SERVER+'/block/height/509849'), //known hash, poa option 2
			axios.get('https://arweave.net/block/height/509849/wallet_list'), //arweave.net keeps old wallet_list
			axios.get(HOST_SERVER+'/block/height/'+HEIGHT_V1_TX), //contains BIG v1 data tx (needs chunking) + v2 txs
		])

		blockKnownHash = await Block.createFromDTO(bjKnownHash.data)
		prevBlockKnownHash = await Block.createFromDTO(bjPrevKnownHash.data)
		prevWalletList = bjPrevWalletList.data
		v1BigV2Block = await Block.createFromDTO(bjV1BigV2.data)

	}catch(e){
		console.debug('Network error! Could not retrieve tests data!', e.code)
		process.exit(1)
	}
}, 60000)

describe('Block tests, with known hash data outputs', () => {

	it('generateBlockDataSegmentBase returns a valid BSDBase hash', async () => {
		expect.assertions(1)
		let hash = await generateBlockDataSegmentBase(blockKnownHash)
		let data = Arweave.utils.bufferTob64Url(hash)
		
		expect(data).toEqual(BDS_BASE_KNOWN_HASH) //BDSBase for /height/509850 hash/si5OoWK-OcYt3LOEDCP2V4SWuj5X5n1LdoTh09-DtOppz_VkE72Cb0DCvygYMbW5
	})

	it('generateBlockDataSegment returns a valid BSD hash', async () => {
		expect.assertions(1)
		let hash = await generateBlockDataSegment(blockKnownHash)
		let data = Arweave.utils.bufferTob64Url(hash)

		expect(data).toEqual(BDS_KNOWN_HASH) //BDS for /height/509850 hash/si5OoWK-OcYt3LOEDCP2V4SWuj5X5n1LdoTh09-DtOppz_VkE72Cb0DCvygYMbW5
	})

	it('getIndepHash returns a valid hash', async () => {
		expect.assertions(1)
		let hash = await getIndepHash(blockKnownHash)
		
		expect(hash).toEqual(blockKnownHash.indep_hash) 
	})

	it('block_verifyTxRoot returns true/false for valid/invalid tx_root hash', async () => {
		expect.assertions(2)
		let good = await block_verifyTxRoot(v1BigV2Block) // this block contains v2 & v1 mixed txs. v1 large data needs chunking also

		let badBlock = Object.assign({}, v1BigV2Block)
		badBlock.txs.push(v1BigV2Block.txs[0]) // add an extra tx to mess up the tx_root computation
		let bad = await block_verifyTxRoot(badBlock)

		expect(good).toEqual(true) 
		expect(bad).toEqual(false) 
	})

})


describe('Wallet_List tests', () => {

	it('WalletList. Validates that valid transactions result in valid wallet list', async () => {
		expect.assertions(3)

		expect(prevWalletList.length).toBeGreaterThan(19000)

		let { updatedWallets } = await nodeUtils_updateWallets(blockKnownHash, prevWalletList, prevBlockKnownHash.reward_pool, prevBlockKnownHash.height)

		expect(updatedWallets).toBeDefined()

		let result = true // result should be true for valid wallet list
		let txs = blockKnownHash.txs

		for (let i = 0; i < txs.length; i++) {
			const tx = txs[i];
			if(await nodeUtils_IsWalletInvalid(tx, updatedWallets)){
				result = false
				break;
			}
		}
		expect(result).toEqual(true)

	}, 20000)

	it('WalletList. Validates that invalid transactions result in invalid wallet list', async () => {
		expect.assertions(3)

		expect(prevWalletList.length).toBeGreaterThan(19000) // make sure we have walletList data

		let { updatedWallets } = await nodeUtils_updateWallets(blockKnownHash, prevWalletList, prevBlockKnownHash.reward_pool, prevBlockKnownHash.height)

		expect(updatedWallets).toBeDefined()

		let result = true // result should be false for invalid wallet list
		let txs = blockKnownHash.txs

		// let's invalidate the wallet list by interfering with the first tx
		let sender = await wallet_ownerToAddressString(txs[0].owner)
		for (let i = 0; i < updatedWallets.length; i++) {
			const entry = updatedWallets[i];
			if(entry.address === sender){
				entry.balance = "-100"
				break;
			}
		}
		// 
		if(await nodeUtils_IsWalletInvalid(txs[0], updatedWallets)){
			result = false
		}
	
		expect(result).toEqual(false)

	}, 20000)
	
})

