import { FORK_HEIGHT_1_8, FORK_HEIGHT_2_0, MINING_REWARD_DIVIDER_MODIFIED, ADD_APPROXIMATION, MINING_REWARD_MULTIPLIER, WALLET_NEVER_SPENT } from './constants'
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
export const updateWalletsWithBlockTxs = async (block: Block, wallets: WalletsObject, rewardPool: bigint, height: number) => {

	if(height < FORK_HEIGHT_1_8){
		throw new Error("nodeUtilsUpdateWallets unimplemented below FORK_HEIGHT_1_8")
	}

	let { baseReward: finderReward, newPool: newRewardPool } = calculateRewardPoolPerpetual(
		rewardPool,
		block.txs,
		block.weave_size,
		block.height,
		block.diff,
		block.timestamp,
	)
	// update wallets
	await applyTxs(wallets, block.txs)
	await applyMiningReward(wallets, block.reward_addr, finderReward, block.height)

	return { newRewardPool, wallets}
}

/* From ar_node_utils:calculate_reward_pool_perpetual */
const calculateRewardPoolPerpetual = (
	oldPool: bigint, 
	txs: Tx[], 
	weaveSize: bigint, 
	height: number, // this is just here for fork error message
	diff: bigint, 
	timestamp: bigint 
) => {

	if(height < FORK_HEIGHT_2_0){
		throw new Error("calculateRewardPoolPerpetual unimplemented below FORK_HEIGHT_2_0")
	}
	/*

		** N.B. See the below inlined algebra for removing fractional calculations **

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

	for (let i = 0; i < txs.length; i++) {
		const tx = txs[i];
		
		let txFee = tx.reward
		let txReward: bigint
		if(ADD_APPROXIMATION){
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
	}

	let baseReward = inflation + txsReward
	let costPerGBPerBlock = txPerpetualStorage_usdToAr(
		txPerpetualStorage_getCostPerBlockAtTimestamp(timestamp),
		diff,
		height
	)
	let burden = weaveSize * BigInt(costPerGBPerBlock) / 1073741824n
	let ar = burden - baseReward
	let newPool = oldPool + txsCost

	if(ar > 0n){
		let take = (newPool < ar) ? newPool : ar
		baseReward += take; newPool -= take
	}
	return { baseReward, newPool }
}

const applyMiningReward = (wallets: WalletsObject, rewardAddr: Uint8Array, quantity: bigint, height: number) => {

	if(height < FORK_HEIGHT_1_8){
		throw new Error("applyMiningReward unimplemented below FORK_HEIGHT_1_8")
	}

	let target = Arweave.utils.bufferTob64Url(rewardAddr)

	if( wallets[target] ){
		wallets[target].balance += quantity
		return 
	} else {
		wallets[target] = {balance: quantity, last_tx: WALLET_NEVER_SPENT}
		return 
	}
}

const applyTxs = async (wallets: WalletsObject, txs: Tx[]) => {

	for (let i = 0; i < txs.length; i++) {
		await applyTxToWalletsObject(wallets, txs[i]) 
	}

	return // wallets is updated directly
}

export const applyTxToWalletsObject = async (wallets: WalletsObject, tx: Tx) => {

	let address = await wallet_ownerToAddressString(tx.owner)

	if(wallets[address]){
		await updateSenderBalance(wallets, tx)
		await updateRecipientBalance(wallets, tx)
		return 
	} 
	
	return 
}

const updateRecipientBalance = (wallets: WalletsObject, tx: Tx) => {

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

const updateSenderBalance = async (wallets: WalletsObject, tx: Tx) => {

	let from = await wallet_ownerToAddressString(tx.owner)

	if( wallets[from] ){
		wallets[from].balance -= tx.quantity
		wallets[from].last_tx = tx.idString

		return // wallets is updated directly
	}

	return // checks happen later for this particular case
}


