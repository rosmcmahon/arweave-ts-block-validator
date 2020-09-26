"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.weave_hash = void 0;
const constants_1 = require("../constants");
const arweave_1 = __importDefault(require("arweave"));
const randomx_1 = require("./randomx");
exports.weave_hash = async (bds, nonce, height) => {
    if (height < constants_1.FORK_HEIGHT_1_7) {
        throw new Error("weaveHash below FORK_HEIGHT_1_7 not implemented");
    }
    const hashData = arweave_1.default.utils.concatBuffers([nonce, bds]);
    return await randomx_1.randomxHash(height, hashData);
};
