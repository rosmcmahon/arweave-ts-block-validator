import axios from 'axios'
import Arweave from "arweave"
import { HOST_SERVER } from './constants'
import { Block,	generateBlockDataSegmentBase, generateBlockDataSegment, getIndepHash, block_verifyTxRoot } from './classes/Block'
import { updateWalletsWithBlockTxs, nodeUtils_IsWalletInvalid } from './wallets-utils'
import { wallet_ownerToAddressString } from './utils/wallet'
import { WalletsObject, createWalletsFromDTO } from './classes/WalletsObject'
import { serialize, deserialize } from 'v8'


//BDSBase & BDS for /height/509850 hash/si5OoWK-OcYt3LOEDCP2V4SWuj5X5n1LdoTh09-DtOppz_VkE72Cb0DCvygYMbW5
const BDS_BASE_KNOWN_HASH = "dOljnXSULT9pTX4wiagcUOqrZZjBWLwKBR3Aoe3-HhNAW_CiKHNsrvqwL14x6BMm"
const BDS_KNOWN_HASH = "uLdZH6FVM-TI_KiA8oZCGbqXwknwyg69ur7KPrSMVPcBljPnIzeOhnPRPyOoifWV"
const HEIGHT_V1_TX = "520919" //contains eIcAGwqFCHek3EvpiRXdsESZAPKLXJMzco-7lWm4yO4 v1 data tx (6MB+, needs chunking) + random v2 txs

let blockKnownHash: Block
let prevBlockKnownHash: Block
let prevWallets: WalletsObject
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
		prevWallets = createWalletsFromDTO(bjPrevWalletList.data)
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

	it('block_verifyTxRoot returns true for valid tx_root hash', async () => {
		expect.assertions(1)
		let good = await block_verifyTxRoot(v1BigV2Block) // this block contains v2 & v1 mixed txs. v1 large data needs chunking also

		expect(good).toEqual(true) 
	})

	it('block_verifyTxRoot returns false for invalid tx_root hash', async () => {
		expect.assertions(1)

		//clone enough
		let badBlock = Object.assign({},v1BigV2Block) 
		badBlock.txs = Object.assign([], v1BigV2Block.txs)

		// add an extra tx to mess up the tx_root computation
		badBlock.txs.push(v1BigV2Block.txs[0]) 
		let bad = await block_verifyTxRoot(badBlock)

		expect(bad).toEqual(false) 
	})

})


describe('Wallet_List tests', () => {

	it('WalletList. Validates that valid transactions result in valid wallet list', async () => {
		expect.assertions(2)

		expect(Object.keys(prevWallets).length).toBeGreaterThan(19000) // check we have wallets

		let updatedWallets = deserialize(serialize(prevWallets)) // clone

		await updateWalletsWithBlockTxs(blockKnownHash, updatedWallets, prevBlockKnownHash.reward_pool, prevBlockKnownHash.height)

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
		expect.assertions(2)

		expect(Object.keys(prevWallets).length).toBeGreaterThan(19000) // make sure we have walletList data

		let updatedWallets = deserialize(serialize(prevWallets)) 

		await updateWalletsWithBlockTxs(blockKnownHash, updatedWallets, prevBlockKnownHash.reward_pool, prevBlockKnownHash.height)

		let result = true // result should be false for invalid wallet list

		// invalidate updatedWallets by interfering with sender balance of tx[0] 
		let sender = await wallet_ownerToAddressString(blockKnownHash.txs[0].owner)
		updatedWallets[sender].balance = -100n

		if(await nodeUtils_IsWalletInvalid(blockKnownHash.txs[0], updatedWallets)){
			result = false
		}
	
		expect(result).toEqual(false)

	}, 20000)
	
})

