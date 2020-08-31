import { FORK_HEIGHT_1_8, FORK_HEIGHT_2_0, MINING_REWARD_DIVIDER } from './constants'
import { Block } from './Block'
import { Tx } from './Tx'
import { Wallet_List } from './types'
import { inflationCalculate } from './Inflation'
import { txPerpetualStorageUsdToAr, txPerpetualStorageGetCostPerBlockAtTimestamp } from './TxPerpetualStorage'
import Arweave from 'arweave'
import { walletOwnerToAddressString } from './Wallet'


export const nodeUtils_IsWalletInvalid = async (tx: Tx, walletList: Wallet_List[]) => {
	// is_wallet_invalid(#tx{ owner = Owner }, Wallets) ->
	// 	Address = ar_wallet:to_address(Owner),
	// 	case maps:get(Address, Wallets, not_found) of
	// 		{Balance, LastTX} when Balance >= 0 ->
	// 			case Balance of
	// 				0 ->
	// 					byte_size(LastTX) == 0;
	// 				_ ->
	// 					false
	// 			end;
	// 		_ ->
	// 			true
	// 	end.
	let address = await walletOwnerToAddressString(tx.owner)


}

// export const nodeUtilsUpdateWallets = async (block: Block, walletList: Wallet_List[], rewardPool: bigint, height: number) => {
// 	/*
// 		%% @doc Update the wallets by applying the new transactions and the mining reward.
// 		%% Return the new reward pool and wallets. It is sufficient to provide the source
// 		%% and the destination wallets of the transactions and the reward wallet.
// 		update_wallets(NewB, Wallets, RewardPool, Height) ->
// 			TXs = NewB#block.txs,
// 			{FinderReward, NewRewardPool} =
// 				ar_node_utils:calculate_reward_pool(	% NOTE: the exported function is used here 
// 					RewardPool,						 							% because it is mocked in
// 					TXs,																% ar_tx_perpetual_storage_tests
// 					NewB#block.reward_addr,
// 					no_recall,
// 					NewB#block.weave_size,
// 					NewB#block.height,
// 					NewB#block.diff,
// 					NewB#block.timestamp
// 				),
// 			UpdatedWallets =
// 				ar_node_utils:apply_mining_reward(
// 					ar_node_utils:apply_txs(Wallets, TXs, Height),
// 					NewB#block.reward_addr,
// 					FinderReward,
// 					NewB#block.height
// 				),
// 			{NewRewardPool, UpdatedWallets}.
// 	*/
// 	if(height < FORK_HEIGHT_1_8){
// 		throw new Error("nodeUtilsUpdateWallets unimplemented below FORK_HEIGHT_1_8")
// 	}

// 	// // need to fetch the block's txns <- this will need to be updated to extend to mining
// 	let txs: Tx[]
// 	if(block.txs === undefined){
// 		txs = await block.getTxs()
// 	}

// 	let { baseReward: finderReward, newPool: newRewardPool } = nodeUtilsCalculateRewardPoolPerpetual(
// 		rewardPool,
// 		txs,
// 		Arweave.utils.bufferTob64Url(block.reward_addr),
// 		null,
// 		block.weave_size,
// 		block.height,
// 		block.diff,
// 		block.timestamp,
// 	)
// 	let updatedWallets = nodeUtilsApplyMiningReward(
// 		nodeUtilsApplyTxs(walletList, txs, height),
// 		block.reward_addr,
// 		finderReward,
// 		block.height
// 	)
// 	return { newRewardPool, updatedWallets }
// }

// export const nodeUtilsCalculateRewardPoolPerpetual = (
// 	oldPool: bigint, 
// 	txs: Tx[], 
// 	rewardAddr: string, 
// 	UNUSED_poa, 
// 	weaveSize: bigint, 
// 	height: number, // this is just here for fork error message
// 	diff: bigint, 
// 	timestamp: bigint 
// ) => {
// 	/*
// 		calculate_reward_pool_perpetual(OldPool, TXs, _, POA, WeaveSize, Height, Diff, Timestamp) ->
// 			Inflation = erlang:trunc(ar_inflation:calculate(Height)),
// 			{TXsCost, TXsReward} = lists:foldl(
// 				fun(TX, {TXCostAcc, TXRewardAcc}) ->
// 					TXFee = TX#tx.reward,
// 					TXReward = erlang:trunc((?MINING_REWARD_MULTIPLIER) * TXFee / ((?MINING_REWARD_MULTIPLIER) + 1)),
// 					//becomes: erlang:trunc((0.2) * TXFee / ((0.2) + 1)),
// 					//becomes: erlang:trunc(5*(0.2) * TXFee / 5*((0.2) + 1)),
// 					//becomes: erlang:trunc(1 * TXFee / (1 + 5)),
// 					//becomes: erlang:trunc(TXFee / 6),
// 					{TXCostAcc + TXFee - TXReward, TXRewardAcc + TXReward}
// 				end,
// 				{0, 0},
// 				TXs
// 			),
// 			BaseReward = Inflation + TXsReward,
// 			CostPerGBPerBlock = ar_tx_perpetual_storage:usd_to_ar(
// 				ar_tx_perpetual_storage:get_cost_per_block_at_timestamp(Timestamp),
// 				Diff,
// 				Height
// 			),
// 			Burden = erlang:trunc(WeaveSize * CostPerGBPerBlock / (1024 * 1024 * 1024)),
// 			AR = Burden - BaseReward,
// 			NewPool = OldPool + TXsCost,
// 			case AR =< 0 of
// 				true ->
// 					{BaseReward, NewPool};
// 				false ->
// 					Take = min(NewPool, AR),
// 					{BaseReward + Take, NewPool - Take}
// 			end.
// 	*/
// 	if(height < FORK_HEIGHT_2_0){
// 		throw new Error("nodeUtilsCalculateRewardPoolPerpetual unimplemented below FORK_HEIGHT_2_0")
// 	}
// 	let inflation: bigint = inflationCalculate(height)
// 	let txsCost: bigint = 0n
// 	let txsReward: bigint = 0n
// 	txs.forEach(tx => {
// 		let txFee = tx.reward
// 		let txReward = txFee / MINING_REWARD_DIVIDER
// 		txsCost += (txFee - txReward)
// 		txsReward += txReward
// 	})
// 	let baseReward = inflation + txsReward
// 	let costPerGBPerBlock = txPerpetualStorageUsdToAr(
// 		txPerpetualStorageGetCostPerBlockAtTimestamp(timestamp),
// 		diff,
// 		height
// 	)
// 	let burden = weaveSize * costPerGBPerBlock / 1073741824n
// 	let ar = burden - baseReward
// 	let newPool = oldPool + txsCost

// 	if(ar > 0n){
// 		let take = (newPool < ar) ? newPool : ar
// 		baseReward += take; newPool -= take
// 	}
// 	return { baseReward, newPool }
// }

// export const nodeUtilsApplyMiningReward = () => {
// 	// %% @doc Calculate and apply mining reward quantities to a wallet list.
// 	// apply_mining_reward(WalletList, unclaimed, _Quantity, _Height) ->
// 	// 	WalletList;
// 	// apply_mining_reward(WalletList, RewardAddr, Quantity, Height) ->
// 	// 	alter_wallet(WalletList, RewardAddr, calculate_reward(Height, Quantity)).
// 	//

// // %% @doc Alter a wallet in a wallet list.
// // alter_wallet(Wallets, Target, Adjustment) ->
// // 	case maps:get(Target, Wallets, not_found) of
// // 		not_found ->
// // 			maps:put(Target, {Adjustment, <<>>}, Wallets);
// // 		{Balance, LastTX} ->
// // 			maps:put(Target, {Balance + Adjustment, LastTX}, Wallets)
// // 	end.

// // %% @doc Calculate the total mining reward for a block and its associated TXs.
// // calculate_reward(Height, Quantity) ->
// // 	case ar_fork:height_1_8() of
// // 		H when Height >= H ->
// // 			Quantity;
// // 		_ ->
// // 			erlang:trunc(ar_inflation:calculate(Height) + Quantity)
// // 	end.
// }

// export const nodeUtilsApplyTxs = (walletList: Wallet_List[], txs: Tx[], height: number ) => {
// 	// %% @doc Update a wallet list with a set of new transactions.
// 	// apply_txs(WalletList, TXs, Height) ->
// 	// 	lists:foldl(
// 	// 		fun(TX, Acc) ->
// 	// 			apply_tx(Acc, TX, Height)
// 	// 		end,
// 	// 		WalletList,
// 	// 		TXs
// 	// 	).

// 	// %% @doc Apply a transaction to a wallet list, updating it.
// 	// apply_tx(WalletList, unavailable, _) ->
// 	// 	WalletList;
// 	// apply_tx(WalletList, TX, Height) ->
// 	// 	do_apply_tx(WalletList, TX, Height).

// 	txs.forEach(tx => {
// 		walletList = nodeUtilsApplyTx(walletList, tx, height)
// 	})

// }

// export const nodeUtilsApplyTx = (walletList: Wallet_List[], tx: Tx, height: number ) => {
// 	// do_apply_tx(
// 	// 	Wallets,
// 	// 	TX = #tx {
// 	// 		last_tx = Last,
// 	// 		owner = From
// 	// 	},
// 	// 	Height) ->
// 	// Addr = ar_wallet:to_address(From),
// 	// case {Height, maps:get(Addr, Wallets, not_found)} of
// 	// 	{H, {_Balance, _LastTX}} when H >= ar_fork:height_1_8() ->
// 	// 		do_apply_tx(Wallets, TX);
// 	// 	{_, {_Balance, Last}} ->
// 	// 		do_apply_tx(Wallets, TX);
// 	// 	_ ->
// 	// 		Wallets
// 	// end.


// }

// // do_apply_tx(WalletList, TX) ->
// // update_recipient_balance(
// // 	update_sender_balance(WalletList, TX),
// // 	TX
// // ).