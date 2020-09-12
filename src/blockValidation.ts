
import { ReturnCode, BlockIndexTuple } from  './types'
import { Block, getIndepHash, generateBlockDataSegment, verifyBlockDepHash, blockFieldSizeLimit, block_verifyWeaveSize, block_verifyBlockHashListMerkle, block_verifyTxRoot } from './classes/Block'
import { validatePoa, poa_modifyDiff } from './classes/Poa'
import { retarget_validateDiff } from './difficulty-retarget'
import { weave_hash } from './weave-hash'
import { validateMiningDifficulty } from './mine'
import { nodeUtils_updateWallets, nodeUtils_IsWalletInvalid } from './node-utils'
import { WalletsObject } from './classes/WalletsObject'
import { serialize, deserialize } from 'v8'
import { STORE_BLOCKS_AROUND_CURRENT, MIN_DIFF_FORK_1_8 } from './constants'


export const validateBlockSlow = async (block: Block, prevBlock: Block, blockIndex: BlockIndexTuple[], prevBlockWallets: WalletsObject): Promise<ReturnCode> => {

	Object.freeze(prevBlockWallets) //this is the wallet state of the previous block, let's leave it that way

	/**
	 * The following 2 steps are taken from ar_http_iface_middleware:post_block
	 * Just 2 quick steps for initial validation - disregarding http bound steps.
	 * The idea there is to return as fast as possible for invalid blocks.
	 */

	// 1. check block height range is +/- STORE_BLOCKS_BEHIND_CURRENT from current
	if(block.height > (prevBlock.height + STORE_BLOCKS_AROUND_CURRENT)){
		return {code: 400, message: "Height is too far ahead"}
	}
	if(block.height < (prevBlock.height - STORE_BLOCKS_AROUND_CURRENT)){
		return {code: 400, message: "Height is too far behind"}
	}

	// 2. check_difficulty( BShadow#block.diff < ar_mine:min_difficulty(BShadow#block.height) )
	if( block.diff < MIN_DIFF_FORK_1_8 ){
		return {code: 400, message: "Difficulty too low"}
	}

	/* 12 steps for "slow" validation (ref: ar_node_utils:validate) */

	// 1. Verify the height of the new block is the one higher than the current height.
	if(block.height !== prevBlock.height + 1){
		return {code: 400, message: "Invalid previous height"}
	}

	// 2. Verify that the previous_block hash of the new block is the indep_hash of the current block.
	if( ! Buffer.from(prevBlock.indep_hash).equals(block.previous_block) ){
		return {code: 400, message: "Invalid previous block hash"}
	}

	// 3. poa:
	// if(! ar_poa:validate(OldB#block.indep_hash, OldB#block.weave_size, BI, POA) ) return false
	if( ! await validatePoa(prevBlock.indep_hash, prevBlock.weave_size, blockIndex, block.poa) ){
		return {code: 400, message: "Invalid PoA", height: block.height}
	}

	// 4. difficulty: 
	// if(! ar_retarget:validate_difficulty(NewB, OldB) ) return false
	if( ! retarget_validateDiff(block, prevBlock) ){
		return {code: 400, message: "Invalid difficulty", height: block.height}
	}

	// 5. independent_hash:
	// if( ar_weave:indep_hash_post_fork_2_0(NewB) != NewB#block.indep_hash ) return false
	let indepHash = await getIndepHash(block)
	if( ! Buffer.from(indepHash).equals(block.indep_hash) ){
		return {code: 400, message: "Invalid independent hash"}
	}

	// 6. wallet_list: 
	// UpdatedWallets = update_wallets(NewB, Wallets, RewardPool, Height)
	// if(any wallets are invalid <is_wallet_invalid> ) return "Invalid updated wallet list"
	let wallets1 = deserialize(serialize(prevBlockWallets)) // clone
	let { updatedWallets: updatedWallets1 } = await nodeUtils_updateWallets(block, wallets1, prevBlock.reward_pool, prevBlock.height)
	// check the updatedWallets
	for (let index = 0; index < block.txs.length; index++) {
		const tx = block.txs[index];
		if( await nodeUtils_IsWalletInvalid(tx, updatedWallets1) ){
			return {code: 400, message: "Invalid wallet list. txid:"+tx.idString, height: block.height}
		}
	}
	
	// 7. block_field_sizes: (block field size checks, no dependencies)
	// if(! ar_block:block_field_size_limit(NewB) ) return false
	if( ! blockFieldSizeLimit(block) ){
		return {code: 400, message: "Received block with invalid field size"}
	}

	// 8. txs: (mempool? weaveState?) N.B. Need the BlockTXPairs for this test! requires 50 blocks. long tx checks
	// if( ar_tx_replay_pool:verify_block_txs === invalid ) return false

	// let result = await ar_tx_replay_pool__verify_block_txs(
	// 	block.txs, 
	// 	block.diff, 
	// 	prevBlock.height, 
	// 	block.timestamp, 
	// 	walletList, 
	// 	blockTxPairs //need last 50 blocks?
	// )
	// if( !result ){
	// 	return {code: 400, message: "Received block with invalid txs"}
	// }
	

	// 9. tx_root: 
	// ar_block:verify_tx_root(NewB) === false; return false
	if( ! await block_verifyTxRoot(block) ){
		return {code: 400, message: "Invalid tx_root", height: block.height}
	}


	// 10. weave_size: 
	// ar_block:verify_weave_size(NewB, OldB, TXs) === false; return false
	if( ! block_verifyWeaveSize(block, prevBlock) ){
		return {code: 400, message: "Invalid weave size", height: block.height}
	}

	// 11. block_index_root:
	// ar_block:verify_block_hash_list_merkle(NewB, OldB, BI) === false; return false
	if( ! await block_verifyBlockHashListMerkle(block, prevBlock, blockIndex) ){
		return {code: 400, message: "Invalid block index root", height: block.height}
	}

	// 12. pow: (depends on RandomX, so had to move to end of validations)
	// POW = ar_weave:hash( ar_block:generate_block_data_segment(NewB), Nonce, Height );
	// if(! ar_block:verify_dep_hash(NewB, POW) ) return false
	// if(! ar_mine:validate(POW, ar_poa:modify_diff(Diff, POA#poa.option), Height) ) return false
	let pow = await weave_hash((await generateBlockDataSegment(block)), block.nonce, block.height)
	if( ! verifyBlockDepHash(block, pow) ){
		return {code: 400, message: "Invalid PoW hash", height: block.height}
	}
	if( ! validateMiningDifficulty(pow, poa_modifyDiff(block.diff, block.poa.option), block.height) ){
		return {code: 400, message: "Invalid PoW", height: block.height}
	}

	return {code:200, message:"Block slow check OK"}
}

