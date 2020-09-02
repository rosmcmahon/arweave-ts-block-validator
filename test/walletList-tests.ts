import axios from 'axios'
import { Block } from '../src/Block';
import { Wallet_List } from '../src/types';
import { nodeUtils_updateWallets, nodeUtils_IsWalletInvalid } from '../src/NodeUtils';
import { wallet_ownerToAddressString } from '../src/Wallet';

const main = async () => {
	//const currentHeight = Number((await axios.get(HOST_SERVER+'/info')).data.height)
	const heightTxs = 509850 // 518727
	const heightWallets = heightTxs-1

	const [b1, b2, b2walletlist] = await Promise.all([
		axios.get('https://arweave.net/block/height/'+heightTxs), 
		axios.get('https://arweave.net/block/height/'+heightWallets), 
		axios.get('https://arweave.net/block/height/'+heightWallets+'/wallet_list'), //arweave.net keeps old wallet_list
	])
	let txsBlock = await Block.createFromDTO(b1.data)
	let wlBlock = await Block.createFromDTO(b2.data)
	let walletList: Wallet_List[] = b2walletlist.data
	
	console.log('walletList.length', b2walletlist.data.length)
	

	let { updatedWallets } = await nodeUtils_updateWallets(txsBlock, walletList, wlBlock.reward_pool, wlBlock.height)
	let txs = txsBlock.txs
	
	
	console.log('checking '+txs.length+' txs')

	for (let i = 0; i < txs.length; i++) {
		const tx = txs[i];
		if(tx.quantity > 0){
			console.log('quantity > 0 of txs['+i+'] = '+tx.quantity)
		}
		if( await nodeUtils_IsWalletInvalid(tx, updatedWallets) ){
			console.log("TEST FAILED: Invalid wallet list")
		} 
	}
	//in this example tx[15] is doing a value transfer quantity > 0

	let sender = await wallet_ownerToAddressString(txs[0].owner)
	for (let i = 0; i < updatedWallets.length; i++) {
		const entry = updatedWallets[i];
		if(entry.address === sender){
			entry.balance = "-100" // let's mess up the sender wallet for this transaction
			break;
		}
	}

	for (let i = 0; i < txs.length; i++) {
		const tx = txs[i];
		if( await nodeUtils_IsWalletInvalid(tx, updatedWallets) ){
			console.log("TEST PASSED: Invalid wallet list")
			break;
		} 
	}

}
main();