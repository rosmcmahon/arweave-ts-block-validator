"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unbalancedMerkle_hashBlockIndexEntry = exports.unbalancedMerkle_root = void 0;
const deepHash_1 = __importDefault(require("./deepHash"));
const arweave_1 = __importDefault(require("arweave"));
exports.unbalancedMerkle_root = async (oldRoot, data) => {
    const hashData = arweave_1.default.utils.concatBuffers([
        oldRoot,
        data
    ]);
    return await arweave_1.default.crypto.hash(hashData, "SHA-384");
};
exports.unbalancedMerkle_hashBlockIndexEntry = async (blockHash, weaveSize, txRoot) => {
    return await deepHash_1.default([
        blockHash,
        arweave_1.default.utils.stringToBuffer(weaveSize.toString()),
        txRoot
    ]);
};
