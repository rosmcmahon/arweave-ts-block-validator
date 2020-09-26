"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateV1TxDataRoot = exports.Tx = void 0;
const arweave_1 = __importDefault(require("arweave"));
const constants_1 = require("../constants");
const merkle_1 = require("../utils/merkle");
const deepHash_1 = __importDefault(require("../utils/deepHash"));
const buffer_utilities_1 = require("../utils/buffer-utilities");
const arweave_cacher_1 = __importDefault(require("arweave-cacher"));
class Tx {
    constructor(dto) {
        this.format = dto.format;
        this.idString = dto.id;
        this.id = arweave_1.default.utils.b64UrlToBuffer(dto.id);
        this.last_tx = arweave_1.default.utils.b64UrlToBuffer(dto.last_tx);
        this.owner = arweave_1.default.utils.b64UrlToBuffer(dto.owner);
        this.tags = dto.tags;
        this.target = dto.target;
        this.quantity = BigInt(dto.quantity);
        this.data = arweave_1.default.utils.b64UrlToBuffer(dto.data);
        this.data_size = BigInt(dto.data_size);
        this.data_tree = dto.data_tree.map(x => arweave_1.default.utils.b64UrlToBuffer(x));
        this.data_root = arweave_1.default.utils.b64UrlToBuffer(dto.data_root);
        this.signature = arweave_1.default.utils.b64UrlToBuffer(dto.signature);
        this.reward = BigInt(dto.reward);
    }
    static async getByIdString(txid) {
        arweave_cacher_1.default.setHostServer(constants_1.HOST_SERVER);
        let txDto = (await arweave_cacher_1.default.getTxDto(txid));
        return new Tx(txDto);
    }
    static async getById(txid) {
        arweave_cacher_1.default.setHostServer(constants_1.HOST_SERVER);
        let txString = arweave_1.default.utils.bufferTob64Url(txid);
        let txDto = (await arweave_cacher_1.default.getTxDto(txString));
        return new Tx(txDto);
    }
    async getDataRoot() {
        if ((this.format === 1) && (this.data_root.length == 0)) {
            return await exports.generateV1TxDataRoot(this);
        }
        if (this.format === 2) {
            return this.data_root;
        }
        throw new Error("Cannot get tx data_root of unsupported tx format = " + this.format);
    }
    async getSignatureData() {
        switch (this.format) {
            case 1:
                let tagString = this.tags.reduce((accumulator, tag) => {
                    return (accumulator +
                        arweave_1.default.utils.b64UrlToString(tag.name) +
                        arweave_1.default.utils.b64UrlToString(tag.value));
                }, "");
                return arweave_1.default.utils.concatBuffers([
                    this.owner,
                    arweave_1.default.utils.b64UrlToBuffer(this.target),
                    this.data,
                    arweave_1.default.utils.stringToBuffer(this.quantity.toString()),
                    arweave_1.default.utils.stringToBuffer(this.reward.toString()),
                    this.last_tx,
                    arweave_1.default.utils.stringToBuffer(tagString)
                ]);
            case 2:
                const tagList = this.tags.map(tag => [
                    arweave_1.default.utils.b64UrlToBuffer(tag.name),
                    arweave_1.default.utils.b64UrlToBuffer(tag.value),
                ]);
                return await deepHash_1.default([
                    arweave_1.default.utils.stringToBuffer(this.format.toString()),
                    this.owner,
                    arweave_1.default.utils.b64UrlToBuffer(this.target),
                    arweave_1.default.utils.stringToBuffer(this.quantity.toString()),
                    arweave_1.default.utils.stringToBuffer(this.reward.toString()),
                    this.last_tx,
                    tagList,
                    arweave_1.default.utils.stringToBuffer(this.data_size.toString()),
                    this.data_root,
                ]);
            default:
                throw new Error(`Unexpected transaction format: ${this.format}`);
        }
    }
    async verify() {
        const sigHash = await arweave_1.default.crypto.hash(this.signature);
        if (!buffer_utilities_1.arrayCompare(this.id, sigHash)) {
            return false;
        }
        const signaturePayload = await this.getSignatureData();
        return arweave_1.default.crypto.verify(arweave_1.default.utils.bufferTob64Url(this.owner), signaturePayload, this.signature);
    }
    async sign(jwk) {
        this.owner = arweave_1.default.utils.b64UrlToBuffer(jwk.n);
        this.signature = await arweave_1.default.crypto.sign(jwk, await this.getSignatureData());
        this.id = await arweave_1.default.crypto.hash(this.signature);
        this.idString = arweave_1.default.utils.bufferTob64Url(this.id);
    }
}
exports.Tx = Tx;
exports.generateV1TxDataRoot = async (tx) => {
    if (tx.format !== 1)
        throw new Error("generateV1TxChunkTree only accepts V1 txs");
    let chunkIdSizes = await sizedChunksToSizedChunkHashes(chunksToSizeTaggedChunks(chunkBinary(tx.data)));
    const root = await merkle_1.computeRootHash(chunkIdSizes);
    return root;
};
const chunkBinary = (data) => {
    if (data.length < constants_1.DATA_CHUNK_SIZE) {
        return [data];
    }
    let newChunk = data.slice(0, constants_1.DATA_CHUNK_SIZE);
    let rest = data.slice(constants_1.DATA_CHUNK_SIZE, data.length);
    return [newChunk, ...chunkBinary(rest)];
};
const chunksToSizeTaggedChunks = (chunks) => {
    let pos = 0n;
    let list = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        pos += BigInt(chunk.length);
        list = [
            ...list,
            { data: chunk, offset: pos }
        ];
    }
    return list;
};
const sizedChunksToSizedChunkHashes = async (sizeTaggedChunks) => {
    return Promise.all(sizeTaggedChunks.map(async (sizeTaggedChunk) => {
        return {
            data: await arweave_1.default.crypto.hash(sizeTaggedChunk.data),
            note: sizeTaggedChunk.offset
        };
    }));
};
