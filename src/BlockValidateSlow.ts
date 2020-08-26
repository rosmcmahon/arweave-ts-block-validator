import { ReturnCode, Tag, BlockIndexTuple } from  './types'
import { Block, getIndepHash, generateBlockDataSegment } from './Block'
import { Poa, validatePoa } from './Poa'
import { retargetValidateDiff } from './Retarget'
import { weaveHash } from './Weave'

export const validateBlockSlow = async (block: Block, prevBlock: Block, blockIndex: BlockIndexTuple[]): Promise<ReturnCode> => {
	/* 13 steps for slow validation (ref: validate in ar_node_utils.erl) */

	// 1. Verify the height of the new block is the one higher than the current height.
	if(block.height !== prevBlock.height + 1){
		return {code: 400, message: "Invalid height"}
	}

	// 2. Verify that the previous_block hash of the new block is the indep_hash of the current block.
	if( ! Buffer.from(prevBlock.indep_hash).equals(block.previous_block) ){
		return {code: 400, message: "Invalid previous_block"}
	}

	// 3. poa:
	// if(! ar_poa:validate(OldB#block.indep_hash, OldB#block.weave_size, BI, POA) ) return false
	if( ! await validatePoa(prevBlock.indep_hash, prevBlock.weave_size, blockIndex, block.poa) ){
		return {code: 400, message: "Invalid PoA"}
	}

	// 4. difficulty: 
	// if(! ar_retarget:validate_difficulty(NewB, OldB) ) return false
	if( ! retargetValidateDiff(block, prevBlock) ){
		return {code: 400, message: "Invalid difficulty"}
	}
	
	// 5. pow: (depends on RandomX)
	// POW = ar_weave:hash( ar_block:generate_block_data_segment(NewB), Nonce, Height );
	// if(! ar_mine:validate(POW, ar_poa:modify_diff(Diff, POA#poa.option), Height) ) return false
	// if(! ar_block:verify_dep_hash(NewB, POW) ) return false
	let pow = await weaveHash((await generateBlockDataSegment(block)), block.nonce, block.height)
	console.log('PoW', pow)

	// 6. independent_hash:
	// if( ar_weave:indep_hash_post_fork_2_0(NewB) != NewB#block.indep_hash ) return false
	let indepHash = await getIndepHash(block)
	if( ! Buffer.from(indepHash).equals(block.indep_hash) ){
		return {code: 400, message: "Invalid independent hash"}
	}

	// 7. wallet_list: (depends on PoW?)
	// get old block reward & height 
	// UpdatedWallets = update_wallets(NewB, Wallets, RewardPool, Height)
	// if(any wallets are invalid) return false

	// 8. block_field_sizes: (block field size checks, no dependencies)
	// if(! ar_block:block_field_size_limit(NewB) ) return false

	// 9. txs: (mempool? weaveState?)
	// if( ar_tx_replay_pool:verify_block_txs === invalid ) return false

	// 10. tx_root: 
	// ar_block:verify_tx_root(NewB) === false; return false

	// 11. weave_size:
	// ar_block:verify_weave_size(NewB, OldB, TXs) === false; return false

	// 12. block_index_root:
	// ar_block:verify_block_hash_list_merkle(NewB, OldB, BI) === false; return false

	// 13. last_retarget:
	// ar_block:verify_last_retarget(NewB, OldB) === false; return false

	return {code:200, message:"Block slow check OK"}
}


