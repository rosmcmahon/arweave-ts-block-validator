
import { ReturnCode, BlockIndexTuple, BlockTxsPairs } from  './types'
import { Block, getIndepHash, generateBlockDataSegment, verifyBlockDepHash, blockFieldSizeLimit, block_verifyWeaveSize, block_verifyBlockHashListMerkle, block_verifyTxRoot } from './classes/Block'
import { validatePoa, poa_modifyDiff } from './classes/Poa'
import { validateDifficulty } from './hashing/difficulty-retarget'
import { weave_hash } from './hashing/weave-hash'
import { validateMiningDifficulty } from './hashing/mine'
import { updateWalletsWithBlockTxs, nodeUtils_IsWalletInvalid } from './wallets-utils'
import { WalletsObject } from './classes/WalletsObject'
import { serialize, deserialize } from 'v8'
import { STORE_BLOCKS_AROUND_CURRENT, MIN_DIFF_FORK_1_8 } from './constants'
import { validateBlockTxs } from './blockTxsValidation'


export const validateBlock = async (
	block: Block, 
	prevBlock: Block, 
	blockIndex: BlockIndexTuple[], 
	prevBlockWallets: WalletsObject,
	blockTxPairs: BlockTxsPairs
): Promise<ReturnCode> => {

	Object.freeze(prevBlockWallets) //this is the wallet state of the previous block, let's leave it that way

	/**
	 * The following 2 steps are taken from `ar_http_iface_middleware:post_block`
	 * Just 2 quick steps for initial validation - disregarding http bound steps.
	 * The idea there is to return as fast as possible for invalid blocks.
	 */

	// 1. Quick check block height range is +/- STORE_BLOCKS_BEHIND_CURRENT from current (prevBlock here)
	if(block.height > (prevBlock.height + STORE_BLOCKS_AROUND_CURRENT)){
		return {value: false, message: "Height is too far ahead"}
	}
	if(block.height < (prevBlock.height - STORE_BLOCKS_AROUND_CURRENT)){
		return {value: false, message: "Height is too far behind"}
	}

	// 2. Quick check_difficulty is greater than minimum difficulty
	if( block.diff < MIN_DIFF_FORK_1_8 ){
		return {value: false, message: "Difficulty too low"}
	}

	/**
	 * 12 steps for "slow" validation based on `ar_node_utils:validate`.
	 * Again the idea is to have the fastest tests first, with the exception of the RandomX testing.
	 */

	// 1. Verify the height of the new block is the one higher than the current height.
	if(block.height !== prevBlock.height + 1){
		return {value: false, message: "Invalid previous height"}
	}

	// 2. Verify that the previous_block hash of the new block is the indep_hash of the current block.
	if( ! Buffer.from(prevBlock.indep_hash).equals(block.previous_block) ){
		return {value: false, message: "Invalid previous block hash"}
	}

	// 3. PoA. Validate the proof of access of the block
	if( ! await validatePoa(prevBlock.indep_hash, prevBlock.weave_size, blockIndex, block.poa) ){
		return {value: false, message: "Invalid PoA", height: block.height}
	}

	// 4. Difficulty: check matches calculated difficulty for this block level, with retarget if necessary.
	if( ! validateDifficulty(block, prevBlock) ){
		return {value: false, message: "Invalid difficulty", height: block.height}
	}

	// 5. Independent Hash: calculate independent hash and check equals given block hash
	let indepHash = await getIndepHash(block)
	if( ! Buffer.from(indepHash).equals(block.indep_hash) ){
		return {value: false, message: "Invalid independent hash"}
	}

	// 6. Wallets list: create & update a new wallets object and check the block txs result in valid wallets
	let updatedWallets1 = deserialize(serialize(prevBlockWallets)) // clone
	let { newRewardPool } = await updateWalletsWithBlockTxs(block, updatedWallets1, prevBlock.reward_pool, prevBlock.height)
	// check the updatedWallets
	for (let index = 0; index < block.txs.length; index++) {
		const tx = block.txs[index];
		if( await nodeUtils_IsWalletInvalid(tx, updatedWallets1) ){
			return {value: false, message: "Invalid wallet list. txid:"+tx.idString, height: block.height}
		}
	}
	if(newRewardPool !== block.reward_pool){
		return {value: false, message: "Reward pool does not match calculated"}
	}
	
	// 7. Block Field Sizes: block field size checks -these probably should be done at the http level
	if( ! blockFieldSizeLimit(block) ){
		return {value: false, message: "Received block with invalid field size"}
	}

	// 8. Block Txs. Validate each block tx against: the block as a whole, individually, and against the weave & wallets state
	let updatedWallets2 = deserialize(serialize(prevBlockWallets)) // clone
	let result = await validateBlockTxs(
		block.txs, 
		block.diff, 
		prevBlock.height, 
		block.timestamp, 
		updatedWallets2, 
		blockTxPairs 
	)
	if( !result ){
		return {value: false, message: "Received block with invalid txs"}
	}
	

	// 9. Tx Toot: recreate the tx_root and compare against given hash
	if( ! await block_verifyTxRoot(block) ){
		return {value: false, message: "Invalid tx_root", height: block.height}
	}


	// 10. Weave Size: check the size is updated correctly
	if( ! block_verifyWeaveSize(block, prevBlock) ){
		return {value: false, message: "Invalid weave size", height: block.height}
	}

	// 11. Block Index Root: recreate the hashes, check against given
	if( ! await block_verifyBlockHashListMerkle(block, prevBlock, blockIndex) ){
		return {value: false, message: "Invalid block index root", height: block.height}
	}

	// 12. PoW: recreate the hashes, check against given -depends on RandomX, so had to move to end of all validations
	let pow = await weave_hash((await generateBlockDataSegment(block)), block.nonce, block.height)
	if( ! verifyBlockDepHash(block, pow) ){
		return {value: false, message: "Invalid PoW hash", height: block.height}
	}
	if( ! validateMiningDifficulty(pow, poa_modifyDiff(block.diff, block.poa.option), block.height) ){
		return {value: false, message: "Invalid PoW", height: block.height}
	}

	return {value: true, message:"Block slow check OK"}
}

