import { FORK_HEIGHT_1_8, FORK_HEIGHT_2_0, MINING_REWARD_DIVIDER_MODIFIED, ADD_ERLANG_ROUNDING_ERROR, MINING_REWARD_MULTIPLIER } from './constants'
import { Block } from './Block'
import { Tx } from './Tx'
import { Wallet_List } from './types'
import { calculateInflation } from './utils/inflation'
import { txPerpetualStorage_usdToAr, txPerpetualStorage_getCostPerBlockAtTimestamp } from './tx-perpetual-storage'
import Arweave from 'arweave'
import { wallet_ownerToAddressString } from './wallet'
import Decimal from 'decimal.js'


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
	let sender = await wallet_ownerToAddressString(tx.owner)
	for (let i = 0; i < walletList.length; i++) {
		const entry = walletList[i];
		if(entry.address === sender){
			let balance = Number(entry.balance)
			if( balance >= 0 ){
				if(balance === 0){
					return entry.last_tx.length === 0 
				}
				return false // good to go
			}
			return true // wallet has negative balance
		}
	}
	return true // wallet or walletList not found
}

export const nodeUtils_updateWallets = async (block: Block, walletList: Wallet_List[], rewardPool: bigint, height: number) => {
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
	let updatedWallets = await nodeUtils_applyMiningReward(
		await nodeUtils_ApplyTxs(walletList, block.txs, height),
		block.reward_addr,
		finderReward,
		block.height
	)
	return { newRewardPool, updatedWallets }
}

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
	let inflation = BigInt(calculateInflation(height).floor())
	let txsCost = 0n
	let txsReward = 0n
	txs.forEach(tx => {
		let txFee = tx.reward
		let txReward: bigint
		if(ADD_ERLANG_ROUNDING_ERROR){
			txReward = BigInt(
				( new Decimal(MINING_REWARD_MULTIPLIER).mul(txFee.toString()) ).div(MINING_REWARD_MULTIPLIER + 1).floor()
			)
		} else{
			txReward = txFee / MINING_REWARD_DIVIDER_MODIFIED
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

export const nodeUtils_applyMiningReward = async (walletList: Wallet_List[], rewardAddr: Uint8Array, quantity: bigint, height: number) => {

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
	for (let i = 0; i < walletList.length; i++) {
		const entry = walletList[i];
		if(entry.address === target){
			entry.balance = ( BigInt(entry.balance) + quantity ).toString()
			return walletList
		}
	}
	walletList.push({address: target, balance: quantity.toString(), last_tx: ''})
	
	return walletList
}

export const nodeUtils_ApplyTxs = async (walletList: Wallet_List[], txs: Tx[], height: number ) => {
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

	txs.forEach( async tx => {
		walletList = await nodeUtils_ApplyTx(walletList, tx, height) 
	})
	return walletList
}

export const nodeUtils_ApplyTx = async (walletList: Wallet_List[], tx: Tx, UNUSED_height: number ) => {

	// do_apply_tx(
	// 	Wallets,
	// 	TX = #tx {
	// 		last_tx = Last,
	// 		owner = From
	// 	},
	// 	Height) ->
	// Addr = ar_wallet:to_address(From),
	// case {Height, maps:get(Addr, Wallets, not_found)} of
	// 	{H, {_Balance, _LastTX}} when H >= ar_fork:height_1_8() ->
	// 		do_apply_tx(Wallets, TX);
	// 	{_, {_Balance, Last}} ->
	// 		do_apply_tx(Wallets, TX);
	// 	_ ->
	// 		Wallets
	// end.
	// do_apply_tx(WalletList, TX) ->
	// update_recipient_balance(
	// 	update_sender_balance(WalletList, TX),
	// 	TX
	// ).

	let address = await wallet_ownerToAddressString(tx.owner)
	for (let i = 0; i < walletList.length; i++) {
		const entry = walletList[i];
		if(entry.address === address){
			walletList = await nodeUtils_updateRecipientBalance(await nodeUtils_UpdateSenderBalance(walletList, tx), tx)
			return walletList
		}
	}

	return walletList
}

const nodeUtils_updateRecipientBalance = async (walletList: Wallet_List[], tx: Tx) => {
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
		return walletList
	}

	for (let i = 0; i < walletList.length; i++) {
		const entry = walletList[i];
		if(entry.address === tx.target){
			entry.balance = ( BigInt(entry.balance) + tx.quantity ).toString()
			return walletList
		}	
	}

	walletList.push({address: tx.target, balance: tx.quantity.toString(), last_tx: ''})  //last_tx is blank??
	return walletList
}

const nodeUtils_UpdateSenderBalance = async (walletList: Wallet_List[], tx: Tx) => {
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
	for (let i = 0; i < walletList.length; i++) {
		const entry = walletList[i];
		if(entry.address === from){
			entry.balance = (BigInt(entry.balance) - (tx.quantity + tx.reward)).toString()
			entry.last_tx = tx.idString

			return walletList
		}
	}

	return walletList
}


