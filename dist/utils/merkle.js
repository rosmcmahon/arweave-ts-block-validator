"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePath = exports.arrayFlatten = exports.generateProofs = exports.generateTree = exports.computeRootHash = void 0;
const arweave_1 = __importDefault(require("arweave"));
const buffer_utilities_1 = require("./buffer-utilities");
const NOTE_SIZE = 32;
const HASH_SIZE = 32;
async function generateLeaves(elements) {
    return Promise.all(elements.map(async ({ data, note }) => {
        return {
            type: "leaf",
            id: await hash(await Promise.all([hash(data), hash(buffer_utilities_1.bigIntToBuffer256(note))])),
            dataHash: data,
            note: note,
            maxByteRange: note,
        };
    }));
}
async function computeRootHash(elements) {
    const rootNode = await generateTree(elements);
    return rootNode.id;
}
exports.computeRootHash = computeRootHash;
async function generateTree(elements) {
    const rootNode = await buildLayers(await generateLeaves(elements));
    return rootNode;
}
exports.generateTree = generateTree;
async function buildLayers(nodes, level = 0) {
    if (nodes.length < 2) {
        const root = await hashBranch(nodes[0], nodes[1]);
        return root;
    }
    const nextLayer = [];
    for (let i = 0; i < nodes.length; i += 2) {
        nextLayer.push(await hashBranch(nodes[i], nodes[i + 1]));
    }
    return buildLayers(nextLayer, level + 1);
}
function generateProofs(root) {
    const proofs = resolveBranchProofs(root);
    if (!Array.isArray(proofs)) {
        return [proofs];
    }
    return arrayFlatten(proofs);
}
exports.generateProofs = generateProofs;
function resolveBranchProofs(node, proof = new Uint8Array(), depth = 0) {
    if (node.type == "leaf") {
        return {
            offset: node.maxByteRange - 1n,
            proof: arweave_1.default.utils.concatBuffers([
                proof,
                node.dataHash,
                buffer_utilities_1.bigIntToBuffer256(node.maxByteRange)
            ])
        };
    }
    if (node.type == "branch") {
        const partialProof = arweave_1.default.utils.concatBuffers([
            proof,
            node.leftChild.id,
            node.rightChild.id,
            buffer_utilities_1.bigIntToBuffer256(node.byteRange)
        ]);
        return [
            resolveBranchProofs(node.leftChild, partialProof, depth + 1),
            resolveBranchProofs(node.rightChild, partialProof, depth + 1)
        ];
    }
    throw new Error(`Unexpected node type`);
}
function arrayFlatten(input) {
    const flat = [];
    input.forEach(item => {
        if (Array.isArray(item)) {
            flat.push(...arrayFlatten(item));
        }
        else {
            flat.push(item);
        }
    });
    return flat;
}
exports.arrayFlatten = arrayFlatten;
async function hashBranch(left, right) {
    if (!right) {
        return left;
    }
    let branch = {
        type: "branch",
        id: await hash([
            await hash(left.id),
            await hash(right.id),
            await hash(buffer_utilities_1.bigIntToBuffer256(left.maxByteRange))
        ]),
        byteRange: left.maxByteRange,
        maxByteRange: right.maxByteRange,
        leftChild: left,
        rightChild: right
    };
    return branch;
}
async function hash(data) {
    if (Array.isArray(data)) {
        data = arweave_1.default.utils.concatBuffers(data);
    }
    return new Uint8Array(await arweave_1.default.crypto.hash(data));
}
async function validatePath(id, dest, leftBound, rightBound, path) {
    if (rightBound <= 0n) {
        return false;
    }
    if (dest >= rightBound) {
        return validatePath(id, 0n, rightBound - 1n, rightBound, path);
    }
    if (dest < 0n) {
        return validatePath(id, 0n, 0n, rightBound, path);
    }
    if (path.length == HASH_SIZE + NOTE_SIZE) {
        const pathData = path.slice(0, HASH_SIZE);
        const endOffsetBuffer = path.slice(pathData.length, pathData.length + NOTE_SIZE);
        const pathDataHash = await hash([
            await hash(pathData),
            await hash(endOffsetBuffer)
        ]);
        let result = buffer_utilities_1.arrayCompare(id, pathDataHash);
        if (result) {
            return {
                data: pathData,
                offset: rightBound - 1n,
                leftBound: leftBound,
                rightBound: rightBound,
                chunkSize: rightBound - leftBound
            };
        }
        return false;
    }
    const left = path.slice(0, HASH_SIZE);
    const right = path.slice(left.length, left.length + HASH_SIZE);
    const offsetBuffer = path.slice(left.length + right.length, left.length + right.length + NOTE_SIZE);
    const offset = buffer_utilities_1.bufferToBigInt(offsetBuffer);
    const remainder = path.slice(left.length + right.length + offsetBuffer.length);
    const pathHash = await hash([
        await hash(left),
        await hash(right),
        await hash(offsetBuffer)
    ]);
    if (buffer_utilities_1.arrayCompare(id, pathHash)) {
        if (dest < offset) {
            return await validatePath(left, dest, leftBound, (rightBound < offset) ? rightBound : offset, remainder);
        }
        return await validatePath(right, dest, (leftBound > offset) ? rightBound : offset, rightBound, remainder);
    }
    return false;
}
exports.validatePath = validatePath;
