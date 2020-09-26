"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const arweave_1 = __importDefault(require("arweave"));
async function deepHash(data) {
    if (Array.isArray(data)) {
        const tag = arweave_1.default.utils.concatBuffers([
            arweave_1.default.utils.stringToBuffer("list"),
            arweave_1.default.utils.stringToBuffer(data.length.toString())
        ]);
        return await deepHashChunks(data, await arweave_1.default.crypto.hash(tag, "SHA-384"));
    }
    const tag = arweave_1.default.utils.concatBuffers([
        arweave_1.default.utils.stringToBuffer("blob"),
        arweave_1.default.utils.stringToBuffer(data.byteLength.toString())
    ]);
    const taggedHash = arweave_1.default.utils.concatBuffers([
        await arweave_1.default.crypto.hash(tag, "SHA-384"),
        await arweave_1.default.crypto.hash(data, "SHA-384")
    ]);
    return await arweave_1.default.crypto.hash(taggedHash, "SHA-384");
}
exports.default = deepHash;
async function deepHashChunks(chunks, acc) {
    if (chunks.length < 1) {
        return acc;
    }
    const hashPair = arweave_1.default.utils.concatBuffers([
        acc,
        await deepHash(chunks[0])
    ]);
    const newAcc = await arweave_1.default.crypto.hash(hashPair, "SHA-384");
    return await deepHashChunks(chunks.slice(1), newAcc);
}
