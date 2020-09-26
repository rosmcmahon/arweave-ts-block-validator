"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.poa_modifyDiff = exports.findPoaChallengeBlock = exports.validatePoa = void 0;
const arweave_1 = __importDefault(require("arweave"));
const Merkle = __importStar(require("../utils/merkle"));
const buffer_utilities_1 = require("../utils/buffer-utilities");
const constants_1 = require("../constants");
const difficulty_retarget_1 = require("../hashing/difficulty-retarget");
exports.validatePoa = async (prevIndepHash, prevWeaveSize, blockIndex, poa) => {
    if (prevWeaveSize === 0n) {
        return true;
    }
    if ((poa.option > blockIndex.length) && (poa.option > constants_1.POA_MIN_MAX_OPTION_DEPTH)) {
        return false;
    }
    let recallByte = buffer_utilities_1.bufferToBigInt(await poaMultiHash(prevIndepHash, poa.option)) % prevWeaveSize;
    const { txRoot, blockBase, blockTop, bh } = exports.findPoaChallengeBlock(recallByte, blockIndex);
    return await validateTxPath((recallByte - blockBase), txRoot, (blockTop - blockBase), poa);
};
const validateTxPath = async (blockOffset, txRoot, blockEndOffset, poa) => {
    let merkleTxPathResult = await Merkle.validatePath(txRoot, blockOffset, 0n, blockEndOffset, poa.tx_path);
    if (merkleTxPathResult === false) {
        return false;
    }
    const { data: dataRoot, leftBound: startOffset, rightBound: endOffset } = merkleTxPathResult;
    let txOffset = blockOffset - startOffset;
    return await validateDataPath(dataRoot, txOffset, endOffset - startOffset, poa);
};
const validateDataPath = async (dataRoot, txOffset, endOffset, poa) => {
    let merkleDataPathResult = await Merkle.validatePath(dataRoot, txOffset, 0n, endOffset, poa.data_path);
    if (merkleDataPathResult === false) {
        return false;
    }
    const { data: chunkId } = merkleDataPathResult;
    return poaValidateChunk(chunkId, poa);
};
const poaValidateChunk = async (chunkId, poa) => {
    let hashed = await txGenerateChunkId(poa.chunk);
    return Buffer.from(chunkId).equals(hashed);
};
const txGenerateChunkId = async (data) => {
    return await arweave_1.default.crypto.hash(data);
};
const poaMultiHash = async (data, remaining) => {
    if (remaining <= 0) {
        return data;
    }
    let hashX = await arweave_1.default.crypto.hash(data, 'SHA-256');
    return poaMultiHash(hashX, remaining - 1);
};
exports.findPoaChallengeBlock = (byte, blockIndex) => {
    let index0 = 0;
    let index1 = 1;
    while (index1 !== blockIndex.length) {
        if ((byte >= BigInt(blockIndex[index1].weave_size)) && (byte < BigInt(blockIndex[index0].weave_size))) {
            return {
                txRoot: arweave_1.default.utils.b64UrlToBuffer(blockIndex[index0].tx_root),
                blockBase: BigInt(blockIndex[index1].weave_size),
                blockTop: BigInt(blockIndex[index0].weave_size),
                bh: arweave_1.default.utils.b64UrlToBuffer(blockIndex[index0].hash),
            };
        }
        ++index0;
        ++index1;
    }
    console.debug('recallByte out of bounds of weave');
};
exports.poa_modifyDiff = (diff, option) => {
    if (option === 1) {
        return diff;
    }
    return exports.poa_modifyDiff(difficulty_retarget_1.multiplyDifficulty(diff, constants_1.ALTERNATIVE_POA_DIFF_MULTIPLIER), option - 1);
};
