import axios from 'axios'
import Arweave from "arweave"
import { BlockDTO, ReturnCode, BlockIndexTuple, Wallet_List } from './types'
import { STORE_BLOCKS_AROUND_CURRENT, HOST_SERVER, RETARGET_BLOCKS } from './constants'
import { validateBlockJson, validateBlockQuick } from "./BlockValidateQuick"
import { validateBlockSlow } from './BlockValidateSlow'
import { Block,	generateBlockDataSegmentBase, generateBlockDataSegment, getIndepHash } from './Block'
import { poa_validate, poa_findChallengeBlock, poa_modifyDiff } from './Poa'
import { retarget_validateDiff } from './Retarget'
import { weave_hash } from './Weave'
import { mine_validate } from './Mine'
import { Tx } from './Tx'
import { nodeUtils_updateWallets, nodeUtils_IsWalletInvalid } from './NodeUtils'
import { wallet_ownerToAddressString } from './Wallet'



let res: ReturnCode
let blockJson: BlockDTO
let blockKnownHash: Block
let prevBlockKnownHash: Block
let prevWalletList: Wallet_List[]


beforeAll(async () => {
	try{

		const [
			bjKnownHash, 
			bjPrevKnownHash, 
			bjPrevWalletList, 
		] = await Promise.all([
			axios.get(HOST_SERVER+'/block/height/509850'), //known hash, poa option 1, has 4 txs
			axios.get(HOST_SERVER+'/block/height/509849'), //known hash, poa option 2
			axios.get('https://arweave.net/block/height/509849/wallet_list'), //arweave.net keeps old wallet_list
		])

		blockKnownHash = await Block.createFromDTO(bjKnownHash.data)
		prevBlockKnownHash = await Block.createFromDTO(bjPrevKnownHash.data)
		prevWalletList = bjPrevWalletList.data
		
	}catch(e){
		console.debug('Network error! Could not retrieve tests data!', e.code)
		process.exit(1)
	}
}, 60000)

describe('Block tests', () => {
	it('generateBlockDataSegmentBase returns a valid BSDBase hash', async () => {
		expect.assertions(1)
		let hash = await generateBlockDataSegmentBase(blockKnownHash)
		let data = Arweave.utils.bufferTob64Url(hash)
		
		expect(data).toEqual("dOljnXSULT9pTX4wiagcUOqrZZjBWLwKBR3Aoe3-HhNAW_CiKHNsrvqwL14x6BMm") 
		//BDSBase for /height/509850 hash/si5OoWK-OcYt3LOEDCP2V4SWuj5X5n1LdoTh09-DtOppz_VkE72Cb0DCvygYMbW5
	}, 20000)

	it('generateBlockDataSegment returns a valid BSD hash', async () => {
		expect.assertions(1)
		let hash = await generateBlockDataSegment(blockKnownHash)
		let data = Arweave.utils.bufferTob64Url(hash)

		expect(data).toEqual("uLdZH6FVM-TI_KiA8oZCGbqXwknwyg69ur7KPrSMVPcBljPnIzeOhnPRPyOoifWV") 
		//BDSBase for /height/509850 hash/si5OoWK-OcYt3LOEDCP2V4SWuj5X5n1LdoTh09-DtOppz_VkE72Cb0DCvygYMbW5
	}, 20000)

	it('getIndepHash returns a valid hash', async () => {
		expect.assertions(1)
		let hash: any = await getIndepHash(blockKnownHash)
		
		expect(new Uint8Array(hash)).toEqual(blockKnownHash.indep_hash) 
	}, 20000)

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

		expect(prevWalletList.length).toBeGreaterThan(19000)

		let { updatedWallets } = await nodeUtils_updateWallets(blockKnownHash, prevWalletList, prevBlockKnownHash.reward_pool, prevBlockKnownHash.height)

		expect(updatedWallets).toBeDefined()

		let res = false // result should be false for invalid wallet list
		let txs = blockKnownHash.txs

		// let's invalidate the wallet list
		let sender = await wallet_ownerToAddressString(txs[0].owner)
		for (let i = 0; i < updatedWallets.length; i++) {
			const entry = updatedWallets[i];
			if(entry.address === sender){
				entry.balance = "-100"
				break;
			}
		}

		for (let i = 0; i < txs.length; i++) {
			const tx = txs[i];
			if(await nodeUtils_IsWalletInvalid(tx, updatedWallets)){
				res = false
				break;
			}
		}
		expect(res).toEqual(false)

	}, 20000)
	
})

