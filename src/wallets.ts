import { Block } from "./classes"




// %% @doc Compute and cache the wallet tree for the given new block, provided with
// %% the previous block's wallet tree root hash, reward pool and height. Return the
// %% root hash of the new wallet tree.
// apply_block(NewB, RootHash, RewardPool, Height) ->
// 	gen_server:call(?MODULE, {apply_block, NewB, RootHash, RewardPool, Height}, infinity).


export const wallets_applyBlockCall = async (block: Block, prevBlock: Block) => {
	const prevRootHash = prevBlock.wallet_list
	const prevRewardPool = prevBlock.reward_pool
	const height = prevBlock.height

	// <- run the wallet server's init code here ? needs "recent blocks" as input, 50 blocks as usual ??

	// handle_call({apply_block, NewB, RootHash, RewardPool, Height}, _From, DAG) ->
	// {Reply, UpdatedDAG} = apply_block(DAG, NewB, RootHash, RewardPool, Height),
	// {reply, Reply, UpdatedDAG};
	//// where is _From, DAG coming from ?? <- server State is set by return of init, and passed to handle_call

	// const wallets_applyBlockDAG = async (dag, block: Block, prevBlock: Block) 
	

}


