"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBlock = void 0;
const Block_1 = require("./classes/Block");
const Poa_1 = require("./classes/Poa");
const difficulty_retarget_1 = require("./hashing/difficulty-retarget");
const weave_hash_1 = require("./hashing/weave-hash");
const mine_1 = require("./hashing/mine");
const wallets_utils_1 = require("./wallets-utils");
const v8_1 = require("v8");
const constants_1 = require("./constants");
const blockTxsValidation_1 = require("./blockTxsValidation");
exports.validateBlock = async (block, prevBlock, blockIndex, prevBlockWallets, blockTxPairs) => {
    Object.freeze(prevBlockWallets);
    if (block.height > (prevBlock.height + constants_1.STORE_BLOCKS_AROUND_CURRENT)) {
        return { value: false, message: "Height is too far ahead" };
    }
    if (block.height < (prevBlock.height - constants_1.STORE_BLOCKS_AROUND_CURRENT)) {
        return { value: false, message: "Height is too far behind" };
    }
    if (block.diff < constants_1.MIN_DIFF_FORK_1_8) {
        return { value: false, message: "Difficulty too low" };
    }
    if (block.height !== prevBlock.height + 1) {
        return { value: false, message: "Invalid previous height" };
    }
    if (!Buffer.from(prevBlock.indep_hash).equals(block.previous_block)) {
        return { value: false, message: "Invalid previous block hash" };
    }
    if (!await Poa_1.validatePoa(prevBlock.indep_hash, prevBlock.weave_size, blockIndex, block.poa)) {
        return { value: false, message: "Invalid PoA", height: block.height };
    }
    if (!difficulty_retarget_1.validateDifficulty(block, prevBlock)) {
        return { value: false, message: "Invalid difficulty", height: block.height };
    }
    let indepHash = await Block_1.getIndepHash(block);
    if (!Buffer.from(indepHash).equals(block.indep_hash)) {
        return { value: false, message: "Invalid independent hash" };
    }
    let updatedWallets1 = v8_1.deserialize(v8_1.serialize(prevBlockWallets));
    let { newRewardPool } = await wallets_utils_1.updateWalletsWithBlockTxs(block, updatedWallets1, prevBlock.reward_pool, prevBlock.height);
    for (let index = 0; index < block.txs.length; index++) {
        const tx = block.txs[index];
        if (await wallets_utils_1.nodeUtils_IsWalletInvalid(tx, updatedWallets1)) {
            return { value: false, message: "Invalid wallet list. txid:" + tx.idString, height: block.height };
        }
    }
    if (newRewardPool !== block.reward_pool) {
        return { value: false, message: "Reward pool does not match calculated" };
    }
    if (!Block_1.blockFieldSizeLimit(block)) {
        return { value: false, message: "Received block with invalid field size" };
    }
    let updatedWallets2 = v8_1.deserialize(v8_1.serialize(prevBlockWallets));
    let result = await blockTxsValidation_1.validateBlockTxs(block.txs, block.diff, prevBlock.height, block.timestamp, updatedWallets2, blockTxPairs);
    if (!result) {
        return { value: false, message: "Received block with invalid txs" };
    }
    if (!await Block_1.block_verifyTxRoot(block)) {
        return { value: false, message: "Invalid tx_root", height: block.height };
    }
    if (!Block_1.block_verifyWeaveSize(block, prevBlock)) {
        return { value: false, message: "Invalid weave size", height: block.height };
    }
    if (!await Block_1.block_verifyBlockHashListMerkle(block, prevBlock)) {
        return { value: false, message: "Invalid block index root", height: block.height };
    }
    let bds = await Block_1.generateBlockDataSegment(block);
    let pow = await weave_hash_1.weave_hash(bds, block.nonce, block.height);
    if (!Block_1.verifyBlockDepHash(block, pow)) {
        return { value: false, message: "Invalid PoW hash", height: block.height };
    }
    if (!mine_1.validateMiningDifficulty(pow, Poa_1.poa_modifyDiff(block.diff, block.poa.option), block.height)) {
        return { value: false, message: "Invalid PoW", height: block.height };
    }
    return { value: true, message: "Block validation OK" };
};
