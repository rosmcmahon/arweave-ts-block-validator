"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomxHash = void 0;
const constants_1 = require("../constants");
const arweave_1 = __importDefault(require("arweave"));
const ar_node_randomx_1 = require("ar-node-randomx");
const arweave_cacher_1 = __importDefault(require("arweave-cacher"));
const initLightRandomx = async (key) => {
    let vm;
    try {
        vm = ar_node_randomx_1.RandomxCreateVM(key, ["jit"]);
    }
    catch (e) {
        console.log(e);
        throw new Error("Error creating RandomX VM.");
    }
    return vm;
};
const hashLightRandomx = async (vm, data) => {
    let hash;
    try {
        hash = ar_node_randomx_1.RandomxHash(vm, data);
    }
    catch (e) {
        console.log(e);
        throw new Error("Error when RandomX hashing.");
    }
    return new Uint8Array(hash);
};
exports.randomxHash = async (height, data) => {
    let key = await randomxKeyByHeight(height);
    let virtualMachine = await initLightRandomx(key);
    return hashLightRandomx(virtualMachine, data);
};
const randomxKeyByHeight = async (height) => {
    let swapHeight = height - (height % constants_1.RANDOMX_KEY_SWAP_FREQ);
    return randomxKey(swapHeight);
};
const randomxKey = async (swapHeight) => {
    if (swapHeight < constants_1.RANDOMX_KEY_SWAP_FREQ) {
        return arweave_1.default.utils.stringToBuffer("Arweave Genesis RandomX Key");
    }
    let keyBlockHeight = swapHeight - constants_1.RANDOMX_KEY_SWAP_FREQ;
    const keyBlock = await arweave_cacher_1.default.getBlockDtoByHeight(keyBlockHeight);
    console.log("\x1b[31mrandomx-debugging:\x1b[0m", "keyBlockHeight", keyBlockHeight);
    return arweave_1.default.utils.b64UrlToBuffer(keyBlock.hash);
};
