"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyTxToWalletsObject = exports.updateWalletsWithBlockTxs = exports.nodeUtils_IsWalletInvalid = void 0;
const constants_1 = require("./constants");
const inflation_1 = require("./fees/inflation");
const tx_perpetual_storage_1 = require("./fees/tx-perpetual-storage");
const arweave_1 = __importDefault(require("arweave"));
const wallet_1 = require("./utils/wallet");
const decimal_js_1 = __importDefault(require("decimal.js"));
exports.nodeUtils_IsWalletInvalid = async (tx, wallets) => {
    let sender = await wallet_1.wallet_ownerToAddressString(tx.owner);
    if (wallets[sender]) {
        let wallet = wallets[sender];
        if (wallet.balance >= 0n) {
            if (wallet.balance === 0n) {
                return wallet.last_tx === constants_1.WALLET_NEVER_SPENT;
            }
            return false;
        }
        return true;
    }
    return true;
};
exports.updateWalletsWithBlockTxs = async (block, wallets, rewardPool, height) => {
    if (height < constants_1.FORK_HEIGHT_1_8) {
        throw new Error("nodeUtilsUpdateWallets unimplemented below FORK_HEIGHT_1_8");
    }
    let { baseReward: finderReward, newPool: newRewardPool } = calculateRewardPoolPerpetual(rewardPool, block.txs, block.weave_size, block.height, block.diff, block.timestamp);
    await applyTxs(wallets, block.txs);
    await applyMiningReward(wallets, block.reward_addr, finderReward, block.height);
    return { newRewardPool, wallets };
};
const calculateRewardPoolPerpetual = (oldPool, txs, weaveSize, height, diff, timestamp) => {
    if (height < constants_1.FORK_HEIGHT_2_0) {
        throw new Error("nodeUtilsCalculateRewardPoolPerpetual unimplemented below FORK_HEIGHT_2_0");
    }
    let inflation = BigInt(Math.floor(inflation_1.calculateInflation(height)));
    let txsCost = 0n;
    let txsReward = 0n;
    for (let i = 0; i < txs.length; i++) {
        const tx = txs[i];
        let txFee = tx.reward;
        let txReward;
        if (constants_1.ADD_ERLANG_ROUNDING_ERROR) {
            txReward = BigInt(Math.floor(Number((new decimal_js_1.default(constants_1.MINING_REWARD_MULTIPLIER).mul(txFee.toString())).div(constants_1.MINING_REWARD_MULTIPLIER + 1))));
        }
        else {
            txReward = txFee / constants_1.MINING_REWARD_DIVIDER_MODIFIED;
        }
        txsCost += (txFee - txReward);
        txsReward += txReward;
    }
    let baseReward = inflation + txsReward;
    let costPerGBPerBlock = tx_perpetual_storage_1.txPerpetualStorage_usdToAr(tx_perpetual_storage_1.txPerpetualStorage_getCostPerBlockAtTimestamp(timestamp), diff, height);
    let burden = weaveSize * costPerGBPerBlock / 1073741824n;
    let ar = burden - baseReward;
    let newPool = oldPool + txsCost;
    if (ar > 0n) {
        let take = (newPool < ar) ? newPool : ar;
        baseReward += take;
        newPool -= take;
    }
    return { baseReward, newPool };
};
const applyMiningReward = (wallets, rewardAddr, quantity, height) => {
    if (height < constants_1.FORK_HEIGHT_1_8) {
        throw new Error("applyMiningReward unimplemented below FORK_HEIGHT_1_8");
    }
    let target = arweave_1.default.utils.bufferTob64Url(rewardAddr);
    if (wallets[target]) {
        wallets[target].balance += quantity;
        return;
    }
    else {
        wallets[target] = { balance: quantity, last_tx: constants_1.WALLET_NEVER_SPENT };
        return;
    }
};
const applyTxs = async (wallets, txs) => {
    for (let i = 0; i < txs.length; i++) {
        await exports.applyTxToWalletsObject(wallets, txs[i]);
    }
    return;
};
exports.applyTxToWalletsObject = async (wallets, tx) => {
    let address = await wallet_1.wallet_ownerToAddressString(tx.owner);
    if (wallets[address]) {
        await updateSenderBalance(wallets, tx);
        await updateRecipientBalance(wallets, tx);
        return;
    }
    return;
};
const updateRecipientBalance = (wallets, tx) => {
    if (tx.quantity === 0n) {
        return;
    }
    if (wallets[tx.target]) {
        wallets[tx.target].balance += tx.quantity;
    }
    else {
        wallets[tx.target] = { balance: tx.quantity, last_tx: constants_1.WALLET_NEVER_SPENT };
    }
    return;
};
const updateSenderBalance = async (wallets, tx) => {
    let from = await wallet_1.wallet_ownerToAddressString(tx.owner);
    if (wallets[from]) {
        wallets[from].balance -= tx.quantity;
        wallets[from].last_tx = tx.idString;
        return;
    }
    return;
};
