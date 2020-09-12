import { FORK_HEIGHT_1_8, FORK_HEIGHT_2_0, MINING_REWARD_DIVIDER_MODIFIED, ADD_ERLANG_ROUNDING_ERROR, MINING_REWARD_MULTIPLIER, WALLET_NEVER_SPENT } from './constants'
import { Block } from './classes/Block'
import { Tx } from './classes/Tx'
import { WalletsObject } from './classes/WalletsObject'
import { calculateInflation } from './fees/inflation'
import { txPerpetualStorage_usdToAr, txPerpetualStorage_getCostPerBlockAtTimestamp } from './fees/tx-perpetual-storage'
import Arweave from 'arweave'
import { wallet_ownerToAddressString } from './utils/wallet'
import Decimal from 'decimal.js'

/* From ar_node_utile:is_wallet_invalid */
export const nodeUtils_IsWalletInvalid = async (tx: Tx, wallets: WalletsObject) => {
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
	let sender = await wallet_ownerToAddressString(tx.owner)

	if(wallets[sender]){
		let wallet = wallets[sender]

		if( wallet.balance >= 0n ){
			if(wallet.balance === 0n){
				return wallet.last_tx === WALLET_NEVER_SPENT
			}
			return false // good to go
		}
		return true // wallet has negative balance
	}

	return true // wallet not found
}

/* From ar_node_utile:update_wallets */
export const nodeUtils_updateWallets = async (block: Block, wallets: WalletsObject, rewardPool: bigint, height: number) => {
	/*
		%% @doc Update the wallets by applying the new transactions and the mining reward.
		%% Return the new reward pool and wallets. It is sufficient to provide the source
		%% and the destination wallets of the transactions and the reward wallet.
		update_wallets(NewB, Wallets, RewardPool, Height) ->
			TXs = NewB#block.txs,
			{FinderReward, NewRewardPool} =
				ar_node_utils:calculate_reward_pool(	% NOTE: the exported function is used here 
					RewardPool,						 							% because it is mocked in
					TXs,																% ar_tx_perpetual_storage_tests
					NewB#block.reward_addr,
					no_recall,
					NewB#block.weave_size,
					NewB#block.height,
					NewB#block.diff,
					NewB#block.timestamp
				),
			UpdatedWallets =
				ar_node_utils:apply_mining_reward(
					ar_node_utils:apply_txs(Wallets, TXs, Height),
					NewB#block.reward_addr,
					FinderReward,
					NewB#block.height
				),
			{NewRewardPool, UpdatedWallets}.
	*/
	if(height < FORK_HEIGHT_1_8){
		throw new Error("nodeUtilsUpdateWallets unimplemented below FORK_HEIGHT_1_8")
	}

	let { baseReward: finderReward, newPool: newRewardPool } = nodeUtils_calculateRewardPoolPerpetual(
		rewardPool,
		block.txs,
		null,
		null,
		block.weave_size,
		block.height,
		block.diff,
		block.timestamp,
	)
	// update wallets
	await nodeUtils_ApplyTxs(wallets, block.txs)
	await nodeUtils_applyMiningReward(wallets, block.reward_addr, finderReward, block.height)

	return { newRewardPool, wallets}
}

/* From ar_node_utile:calculate_reward_pool_perpetual */
export const nodeUtils_calculateRewardPoolPerpetual = (
	oldPool: bigint, 
	txs: Tx[], 
	UNUSED_rewardAddr, 
	UNUSED_poa, 
	weaveSize: bigint, 
	height: number, // this is just here for fork error message
	diff: bigint, 
	timestamp: bigint 
) => {

	if(height < FORK_HEIGHT_2_0){
		throw new Error("nodeUtilsCalculateRewardPoolPerpetual unimplemented below FORK_HEIGHT_2_0")
	}
	/*
		calculate_reward_pool_perpetual(OldPool, TXs, _, POA, WeaveSize, Height, Diff, Timestamp) ->
			Inflation = erlang:trunc(ar_inflation:calculate(Height)),
			{TXsCost, TXsReward} = lists:foldl(
				fun(TX, {TXCostAcc, TXRewardAcc}) ->
					TXFee = TX#tx.reward,
					TXReward = erlang:trunc((?MINING_REWARD_MULTIPLIER) * TXFee / ((?MINING_REWARD_MULTIPLIER) + 1)),
					//becomes: erlang:trunc((0.2) * TXFee / ((0.2) + 1)),
					//becomes: erlang:trunc(5*(0.2) * TXFee / 5*((0.2) + 1)),
					//becomes: erlang:trunc(1 * TXFee / (1 + 5)),
					//becomes: erlang:trunc(TXFee / 6), <= new constant MINING_REWARD_DIVIDER_MODIFIED
					{TXCostAcc + TXFee - TXReward, TXRewardAcc + TXReward}
				end,
				{0, 0},
				TXs
			),
			BaseReward = Inflation + TXsReward,
			CostPerGBPerBlock = ar_tx_perpetual_storage:usd_to_ar(
				ar_tx_perpetual_storage:get_cost_per_block_at_timestamp(Timestamp),
				Diff,
				Height
			),
			Burden = erlang:trunc(WeaveSize * CostPerGBPerBlock / (1024 * 1024 * 1024)),
			AR = Burden - BaseReward,
			NewPool = OldPool + TXsCost,
			case AR =< 0 of
				true ->
					{BaseReward, NewPool};
				false ->
					Take = min(NewPool, AR),
					{BaseReward + Take, NewPool - Take}
			end.
	*/
	let inflation = BigInt(Math.floor( calculateInflation(height) ))
	let txsCost = 0n
	let txsReward = 0n

	txs.forEach(tx => {
		let txFee = tx.reward
		let txReward: bigint
		if(ADD_ERLANG_ROUNDING_ERROR){
			txReward = BigInt(
				Math.floor(Number(
					( new Decimal(MINING_REWARD_MULTIPLIER).mul(txFee.toString()) ).div(MINING_REWARD_MULTIPLIER + 1)
				))
			)
		} else{
			txReward = txFee / MINING_REWARD_DIVIDER_MODIFIED //see comments above for derivation
		}
		txsCost += (txFee - txReward)
		txsReward += txReward
	})

	let baseReward = inflation + txsReward
	let costPerGBPerBlock = txPerpetualStorage_usdToAr(
		txPerpetualStorage_getCostPerBlockAtTimestamp(timestamp),
		diff,
		height
	)
	let burden = weaveSize * costPerGBPerBlock / 1073741824n
	let ar = burden - baseReward
	let newPool = oldPool + txsCost

	if(ar > 0n){
		let take = (newPool < ar) ? newPool : ar
		baseReward += take; newPool -= take
	}
	return { baseReward, newPool }
}

export const nodeUtils_applyMiningReward = (wallets: WalletsObject, rewardAddr: Uint8Array, quantity: bigint, height: number) => {

	if(height < FORK_HEIGHT_1_8){
		throw new Error("nodeUtils_applyMiningReward unimplemented below FORK_HEIGHT_1_8")
	}
	// %% @doc Calculate and apply mining reward quantities to a wallet list.
	// apply_mining_reward(WalletList, unclaimed, _Quantity, _Height) ->
	// 	WalletList;
	// apply_mining_reward(WalletList, RewardAddr, Quantity, Height) ->
	// 	alter_wallet(WalletList, RewardAddr, Quantity).
	//

	// %% @doc Alter a wallet in a wallet list.
	// alter_wallet(Wallets, Target, Adjustment) ->
	// 	case maps:get(Target, Wallets, not_found) of
	// 		not_found ->
	// 			maps:put(Target, {Adjustment, <<>>}, Wallets);
	// 		{Balance, LastTX} ->
	// 			maps:put(Target, {Balance + Adjustment, LastTX}, Wallets)
	// 	end.
	let target = Arweave.utils.bufferTob64Url(rewardAddr)

	if( wallets[target] ){
		wallets[target].balance += quantity
		return 
	} else {
		wallets[target] = {balance: quantity, last_tx: WALLET_NEVER_SPENT}
		return 
	}
}

const nodeUtils_ApplyTxs = async (wallets: WalletsObject, txs: Tx[]) => {
	// %% @doc Update a wallet list with a set of new transactions.
	// apply_txs(WalletList, TXs, Height) ->
	// 	lists:foldl(
	// 		fun(TX, Acc) ->
	// 			apply_tx(Acc, TX, Height)
	// 		end,
	// 		WalletList,
	// 		TXs
	// 	).

	// %% @doc Apply a transaction to a wallet list, updating it.
	// apply_tx(WalletList, unavailable, _) ->
	// 	WalletList;
	// apply_tx(WalletList, TX, Height) ->
	// 	do_apply_tx(WalletList, TX, Height).

	for (let i = 0; i < txs.length; i++) {
		await nodeUtils_ApplyTx(wallets, txs[i]) 
	}

	return // wallets is updated directly
}

export const nodeUtils_ApplyTx = async (wallets: WalletsObject, tx: Tx) => {

	let address = await wallet_ownerToAddressString(tx.owner)

	if(wallets[address]){
		await nodeUtils_UpdateSenderBalance(wallets, tx)
		await nodeUtils_updateRecipientBalance(wallets, tx)
		return 
	} 
	
	return 
}

const nodeUtils_updateRecipientBalance = (wallets: WalletsObject, tx: Tx) => {
	// update_recipient_balance(
	// 	Wallets,
	// 	#tx {
	// 		target = To,
	// 		quantity = Qty
	// 	}) ->
	// case maps:get(To, Wallets, not_found) of
	// 	not_found ->
	// 		maps:put(To, {Qty, <<>>}, Wallets);
	// 	{OldBalance, LastTX} ->
	// 		maps:put(To, {OldBalance + Qty, LastTX}, Wallets)
	// end.
	if(tx.quantity === 0n){
		return 
	}

	if( wallets[tx.target] ){
		wallets[tx.target].balance += tx.quantity
	}else{
		wallets[tx.target] = {balance: tx.quantity, last_tx: WALLET_NEVER_SPENT}
	}

	return // wallets is updated directly
}

const nodeUtils_UpdateSenderBalance = async (wallets: WalletsObject, tx: Tx) => {
	// update_sender_balance(
	// 	Wallets,
	// 	#tx {
	// 		id = ID,
	// 		owner = From,
	// 		quantity = Qty,
	// 		reward = Reward
	// 	}) ->
	// Addr = ar_wallet:to_address(From),
	// case maps:get(Addr, Wallets, not_found) of
	// 	{Balance, _LastTX} ->
	// 		maps:put(Addr, {Balance - (Qty + Reward), ID}, Wallets);
	// 	_ ->
	// 		Wallets
	// end.
	let from = await wallet_ownerToAddressString(tx.owner)

	if( wallets[from] ){
		wallets[from].balance -= tx.quantity
		wallets[from].last_tx = tx.idString

		return // wallets is updated directly
	}

	return // checks happen later for this particular case
}


