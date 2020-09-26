"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTx = exports.validateBlockTxs = void 0;
const constants_1 = require("./constants");
const wallet_1 = require("./utils/wallet");
const arweave_1 = __importDefault(require("arweave"));
const wallets_utils_1 = require("./wallets-utils");
const tx_perpetual_storage_1 = require("./fees/tx-perpetual-storage");
const v8_1 = require("v8");
const RETURNCODE_TRUE = { value: true, message: "Valid block txs" };
exports.validateBlockTxs = async (txs, diff, height, timestamp, prevBlockWallets, blockTxsPairs) => {
    if (height < constants_1.FORK_HEIGHT_1_8)
        throw new Error("ar_tx_replay_pool__verify_block_txs invalid before FORK_HEIGHT_1_8");
    if (txs === []) {
        return RETURNCODE_TRUE;
    }
    if (txs.length > constants_1.BLOCK_TX_COUNT_LIMIT) {
        return { value: false, message: "BLOCK_TX_COUNT_LIMIT exceeded" };
    }
    let updatedWallets = v8_1.deserialize(v8_1.serialize(prevBlockWallets));
    let verifiedTxs = [];
    let size = 0n;
    for (let i = 0; i < txs.length; i++) {
        const tx = txs[i];
        if (tx.format === 1) {
            size += tx.data_size;
        }
        if (size > constants_1.BLOCK_TX_DATA_SIZE_LIMIT) {
            return { value: false, message: "BLOCK_TX_DATA_SIZE_LIMIT exceeded" };
        }
        let validateTxResult = await validateBlockTx(tx, diff, height, timestamp, updatedWallets, blockTxsPairs, verifiedTxs);
        if (validateTxResult.value === false) {
            return validateTxResult;
        }
    }
    return RETURNCODE_TRUE;
};
const validateBlockTx = async (tx, diff, height, timestamp, wallets, blockTxsPairs, verifiedTxs) => {
    let lastTxString = arweave_1.default.utils.bufferTob64Url(tx.last_tx);
    let verifyTxResult = await exports.verifyTx(tx, diff, height, timestamp, wallets);
    if (verifyTxResult.value === false) {
        return verifyTxResult;
    }
    if (verifiedTxs.includes(lastTxString)) {
        return { value: false, message: 'last_tx in verified txs pool' };
    }
    if (await verifyLastTxForWallets(wallets, tx)) {
        verifiedTxs.push(tx.idString);
        await wallets_utils_1.applyTxToWalletsObject(wallets, tx);
        return RETURNCODE_TRUE;
    }
    if (!blockTxsPairs[lastTxString]) {
        return { value: false, message: "last_tx anchor not in blockTxsPairs" };
    }
    if (blockTxsPairs_containsTx(tx.idString, blockTxsPairs)) {
        return { value: false, message: "tx already in blockTxsPairs" };
    }
    if (verifiedTxs.includes(tx.idString)) {
        return { value: false, message: "tx already in verifiedTxs" };
    }
    verifiedTxs.push(tx.idString);
    await wallets_utils_1.applyTxToWalletsObject(wallets, tx);
    return RETURNCODE_TRUE;
};
const blockTxsPairs_containsTx = (txid, blockTxsPairs) => {
    for (const blockId in blockTxsPairs) {
        if (blockTxsPairs[blockId].includes(txid)) {
            return true;
        }
    }
    return false;
};
const verifyLastTxForWallets = async (wallets, tx) => {
    let address = await wallet_1.wallet_ownerToAddressString(tx.owner);
    let last_tx = arweave_1.default.utils.bufferTob64Url(tx.last_tx);
    if (wallets[address] && (wallets[address].last_tx === last_tx)) {
        return true;
    }
    return false;
};
exports.verifyTx = async (tx, diff, height, timestamp, wallets) => {
    if (tx.quantity < 0n) {
        return { value: false, message: "tx quantity negative" };
    }
    if (tx.target === await wallet_1.wallet_ownerToAddressString(tx.owner)) {
        return { value: false, message: "tx owner same as tx target" };
    }
    if (!await tx.verify()) {
        return { value: false, message: "invalid signature or txid. Hash mismatch" };
    }
    if (tx.reward < calculateMinTxCost(tx.data_size, diff, height + 1, wallets, tx.target, timestamp)) {
        return { value: false, message: "tx reward too cheap" };
    }
    if (!tag_field_legal(tx)) {
        return { value: false, message: "tx tag_field_illegally_specified" };
    }
    let walletsClone = v8_1.deserialize(v8_1.serialize(wallets));
    await wallets_utils_1.applyTxToWalletsObject(walletsClone, tx);
    if (!await validateOverspend(tx, walletsClone)) {
        return { value: false, message: "overspend in tx" };
    }
    if (tx.format === 1) {
        if (!tx_field_size_limit_v1(tx)) {
            return { value: false, message: "tx_fields_too_large" };
        }
    }
    else if (tx.format === 2) {
        if (!await tx_field_size_limit_v2(tx)) {
            return { value: false, message: "tx_fields_too_large" };
        }
        if (tx.data_size < 0n) {
            return { value: false, message: "tx_data_size_negative" };
        }
        if ((tx.data_size === 0n) !== ((await tx.getDataRoot()).length === 0)) {
            return { value: false, message: "tx_data_size_data_root_mismatch" };
        }
    }
    else {
        throw new Error(`tx format = ${tx.format} not supported`);
    }
    return RETURNCODE_TRUE;
};
const calculateMinTxCost = (size, diff, height, wallets, target, timestamp) => {
    if (height < constants_1.FORK_HEIGHT_1_8)
        throw new Error("calculate_min_tx_cost unsupported before FORK_HEIGHT_1_8");
    let fee = 0n;
    if (!wallets[target]) {
        fee = constants_1.WALLET_GEN_FEE;
    }
    fee += tx_perpetual_storage_1.txPerpetualStorage_calculateTxFee(size, diff, height, timestamp);
    return fee;
};
const tag_field_legal = (tx) => {
    for (let i = 0; i < tx.tags.length; i++) {
        const tag = tx.tags[i];
        if (tag.name === undefined
            || tag.value === undefined
            || typeof tag.name !== 'string'
            || typeof tag.value !== 'string') {
            return false;
        }
    }
    return true;
};
const validateOverspend = async (tx, wallets) => {
    let from = await wallet_1.wallet_ownerToAddressString(tx.owner);
    if (wallets[from]) {
        let wallet = wallets[from];
        if (wallet.balance === 0n && wallet.last_tx === constants_1.WALLET_NEVER_SPENT) {
            return false;
        }
        if (wallet.balance < 0n) {
            return false;
        }
    }
    else {
        return false;
    }
    if (tx.target !== '') {
        let to = tx.target;
        if (wallets[to]) {
            let wallet = wallets[to];
            if (wallet.balance === 0n && wallet.last_tx === constants_1.WALLET_NEVER_SPENT) {
                return false;
            }
            if (wallet.balance < 0n) {
                return false;
            }
        }
        else {
            return false;
        }
    }
    return true;
};
const tx_field_size_limit_v1 = (tx) => {
    return tx.id.length <= 32
        && tx.last_tx.length <= 48
        && tx.owner.length <= 512
        && getTagsLength(tx.tags) <= 2048
        && tx.target.length <= 43
        && tx.quantity.toString().length <= 21
        && tx.signature.length <= 512
        && tx.reward.toString().length <= 21
        && tx.data.length <= constants_1.TX_DATA_SIZE_LIMIT;
};
const tx_field_size_limit_v2 = async (tx) => {
    return tx.id.length <= 32
        && tx.last_tx.length <= 48
        && tx.owner.length <= 512
        && getTagsLength(tx.tags) <= 2048
        && tx.target.length <= 43
        && tx.quantity.toString().length <= 21
        && tx.signature.length <= 512
        && tx.reward.toString().length <= 21
        && tx.data_size.toString().length <= 21
        && (await tx.getDataRoot()).length <= 32;
};
const getTagsLength = (tags) => {
    let total = 0;
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        total += tag.name.length + tag.value.length;
    }
    return total;
};
