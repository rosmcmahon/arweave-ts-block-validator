"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.block_verifyTxRoot = exports.block_verifyBlockHashListMerkle = exports.block_verifyWeaveSize = exports.blockFieldSizeLimit = exports.verifyBlockDepHash = exports.generateBlockDataSegmentBase = exports.generateBlockDataSegment = exports.getIndepHash = exports.Block = void 0;
const constants_1 = require("../constants");
const arweave_1 = __importDefault(require("arweave"));
const deepHash_1 = __importDefault(require("../utils/deepHash"));
const buffer_utilities_1 = require("../utils/buffer-utilities");
const Tx_1 = require("./Tx");
const merkle_1 = require("../utils/merkle");
const unbalanced_merkle_1 = require("../utils/unbalanced-merkle");
class Block {
    static async createFromDTO(dto) {
        let b = new Block();
        b.nonce = arweave_1.default.utils.b64UrlToBuffer(dto.nonce);
        b.previous_block = arweave_1.default.utils.b64UrlToBuffer(dto.previous_block);
        b.timestamp = BigInt(dto.timestamp);
        b.last_retarget = BigInt(dto.last_retarget);
        b.diff = BigInt(dto.diff);
        b.diffString = dto.diff;
        b.height = dto.height;
        b.hash = arweave_1.default.utils.b64UrlToBuffer(dto.hash);
        b.indep_hash = arweave_1.default.utils.b64UrlToBuffer(dto.indep_hash);
        b.txids = dto.txs.map(txid => arweave_1.default.utils.b64UrlToBuffer(txid));
        let promises = dto.txs.map(txid => Tx_1.Tx.getByIdString(txid));
        b.txs = await Promise.all(promises);
        b.tx_root = arweave_1.default.utils.b64UrlToBuffer(dto.tx_root);
        b.tx_tree = dto.tx_tree.map(b64urlTxHash => arweave_1.default.utils.b64UrlToBuffer(b64urlTxHash));
        b.wallet_list = arweave_1.default.utils.b64UrlToBuffer(dto.wallet_list);
        b.reward_addr = arweave_1.default.utils.b64UrlToBuffer(dto.reward_addr);
        b.tags = dto.tags.map((tag) => {
            return {
                name: arweave_1.default.utils.b64UrlToString(tag.name),
                value: arweave_1.default.utils.b64UrlToString(tag.value)
            };
        });
        b.reward_pool = BigInt(dto.reward_pool);
        b.weave_size = BigInt(dto.weave_size);
        b.block_size = BigInt(dto.block_size);
        b.cumulative_diff = BigInt(dto.cumulative_diff);
        b.hash_list_merkle = arweave_1.default.utils.b64UrlToBuffer(dto.hash_list_merkle);
        b.poa = {
            option: parseInt(dto.poa.option),
            tx_path: arweave_1.default.utils.b64UrlToBuffer(dto.poa.tx_path),
            data_path: arweave_1.default.utils.b64UrlToBuffer(dto.poa.data_path),
            chunk: arweave_1.default.utils.b64UrlToBuffer(dto.poa.chunk)
        };
        return b;
    }
}
exports.Block = Block;
exports.getIndepHash = async (block) => {
    let BDS = await exports.generateBlockDataSegment(block);
    let deep = await deepHash_1.default([
        BDS,
        block.hash,
        block.nonce,
    ]);
    return new Uint8Array(deep);
};
exports.generateBlockDataSegment = async (block) => {
    let BDSBase = await exports.generateBlockDataSegmentBase(block);
    return await deepHash_1.default([
        BDSBase,
        arweave_1.default.utils.stringToBuffer(block.timestamp.toString()),
        arweave_1.default.utils.stringToBuffer(block.last_retarget.toString()),
        arweave_1.default.utils.stringToBuffer(block.diffString),
        arweave_1.default.utils.stringToBuffer(block.cumulative_diff.toString()),
        arweave_1.default.utils.stringToBuffer(block.reward_pool.toString()),
        block.wallet_list,
        block.hash_list_merkle,
    ]);
};
exports.generateBlockDataSegmentBase = async (block) => {
    return await deepHash_1.default([
        arweave_1.default.utils.stringToBuffer(block.height.toString()),
        block.previous_block,
        block.tx_root,
        block.txids,
        arweave_1.default.utils.stringToBuffer(block.block_size.toString()),
        arweave_1.default.utils.stringToBuffer(block.weave_size.toString()),
        block.reward_addr,
        block.tags.map((tag) => [
            arweave_1.default.utils.stringToBuffer(tag.name),
            arweave_1.default.utils.stringToBuffer(tag.value),
        ]),
        [
            arweave_1.default.utils.stringToBuffer(block.poa.option.toString()),
            block.poa.tx_path,
            block.poa.data_path,
            block.poa.chunk,
        ]
    ]);
};
exports.verifyBlockDepHash = (block, pow) => {
    return buffer_utilities_1.arrayCompare(block.hash, pow);
};
exports.blockFieldSizeLimit = (block) => {
    if (block.height < constants_1.FORK_HEIGHT_1_8)
        throw new Error("Block.blockFieldSizeLimit < FORK_HEIGHT_1_8 not implenented");
    let diffBytesLimit = 78;
    let chunkSize = block.poa.chunk.length;
    let dataPathSize = block.poa.data_path.length;
    return block.nonce.length <= 512
        && block.previous_block.length <= 48
        && block.timestamp.toString().length <= 12
        && block.last_retarget.toString().length <= 12
        && block.diff.toString().length <= diffBytesLimit
        && block.height.toString().length <= 20
        && block.hash.length <= 48
        && block.indep_hash.length <= 48
        && block.reward_addr.length <= 32
        && getTagsLength(block.tags) <= 2048
        && block.weave_size.toString().length <= 64
        && block.block_size.toString().length <= 64
        && chunkSize <= constants_1.DATA_CHUNK_SIZE
        && dataPathSize <= constants_1.MAX_PATH_SIZE;
};
const getTagsLength = (tags) => {
    let total = 0;
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        total += tag.name.length + tag.value.length;
    }
    return total;
};
exports.block_verifyWeaveSize = (block, prevBlock) => {
    let newSize = prevBlock.weave_size;
    let txs = block.txs;
    for (let i = 0; i < txs.length; i++) {
        const tx = txs[i];
        newSize += tx.data_size;
    }
    return block.weave_size === newSize;
};
exports.block_verifyBlockHashListMerkle = async (block, prevBlock) => {
    if (block.height < constants_1.FORK_HEIGHT_2_0)
        throw new Error("Unavailable: block_verifyBlockHashListMerkle < FORK_HEIGHT_2_0");
    return buffer_utilities_1.arrayCompare(block.hash_list_merkle, await unbalanced_merkle_1.unbalancedMerkle_root(prevBlock.hash_list_merkle, await unbalanced_merkle_1.unbalancedMerkle_hashBlockIndexEntry(prevBlock.indep_hash, prevBlock.weave_size, prevBlock.tx_root)));
};
exports.block_verifyTxRoot = async (block) => {
    return buffer_utilities_1.arrayCompare(block.tx_root, await generateTxRootForBlock(block.txs));
};
const generateTxRootForBlock = async (txs) => {
    if (txs.length === 0) {
        return new Uint8Array(0);
    }
    let sizeTaggedTxs = await generateSizeTaggedList(txs);
    let sizeTaggedDataRoots = generateSizeTaggedDataRootsStructure(sizeTaggedTxs);
    const root = await merkle_1.computeRootHash(sizeTaggedDataRoots);
    return root;
};
const generateSizeTaggedDataRootsStructure = (sizeTaggedTxs) => {
    return sizeTaggedTxs.map(sizeTagged => {
        let { data, offset } = sizeTagged;
        let { root } = data;
        return { data: root, note: offset };
    });
};
const generateSizeTaggedList = async (txs) => {
    let sortedTxs = sortTxs(txs);
    let pos = 0n;
    let list = [];
    for (let i = 0; i < sortedTxs.length; i++) {
        const tx = sortedTxs[i];
        pos += tx.data_size;
        list = [
            ...list,
            { data: { id: tx.id, root: await tx.getDataRoot() }, offset: pos },
        ];
    }
    return list;
};
const sortTxs = (txs) => {
    let idSort = txs.sort((a, b) => buffer_utilities_1.bufferToInt(a.id) - buffer_utilities_1.bufferToInt(b.id));
    let formatSort = idSort.sort((a, b) => a.format - b.format);
    return formatSort;
};
