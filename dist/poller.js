"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const arweave_cacher_1 = __importDefault(require("arweave-cacher"));
const arweave_1 = __importDefault(require("arweave"));
const classes_1 = require("./classes");
const constants_1 = require("./constants");
const blockValidation_1 = require("./blockValidation");
const main = async () => {
    let height = await arweave_cacher_1.default.getCurrentHeight() - 10;
    let { blockDtos, blockIndex, prevWallets, blockTxsPairs } = await initData(height);
    while (true) {
        let [block, prevBlock] = await Promise.all([
            classes_1.Block.createFromDTO(blockDtos[0]),
            classes_1.Block.createFromDTO(blockDtos[1])
        ]);
        console.log(`Validating new height ${block.height}...`);
        let result = await blockValidation_1.validateBlock(block, prevBlock, blockIndex, prevWallets, blockTxsPairs);
        if (result.value) {
            console.log('✔️  Block validation passed');
        }
        else {
            console.log('⛔  Block validation failed');
        }
        console.log('New block info:');
        console.log('Height\t\t', block.height);
        console.log('Indep_hash\t', arweave_1.default.utils.bufferTob64Url(block.indep_hash));
        console.log('Numer of Txs\t', block.txs.length);
        console.log('Timestamp\t', new Date(Number(block.timestamp) * 1000).toLocaleString());
        console.log(`New Weave Data\t ${(block.block_size) / (1024n ** 2n)} MBs`);
        console.log(`New Weave Size\t ${block.weave_size / (1024n ** 3n)} GBs`);
        height++;
        let newBlockDto = await pollForNewBlock(height);
        let extraBlock = blockDtos[blockDtos.length - 1];
        delete blockTxsPairs[extraBlock.indep_hash];
        blockDtos.pop();
        blockDtos = [newBlockDto, ...blockDtos];
    }
};
main();
const initData = async (height) => {
    let promises = [];
    arweave_cacher_1.default.setHostServer(constants_1.HOST_SERVER);
    arweave_cacher_1.default.setDebugMessagesOn(true);
    promises.push(arweave_cacher_1.default.getBlockIndex(height - 1));
    promises.push(arweave_cacher_1.default.getWalletList(height - 1));
    let h = height;
    for (let i = 0; i < 51; i++) {
        promises.push(arweave_cacher_1.default.getBlockDtoByHeight(h));
        h--;
    }
    const [bIndex, walletList, ...responses] = await Promise.all(promises);
    let blockIndex = bIndex;
    if (!blockIndex[0].hash) {
        throw new Error('Error! Incorrect BlockIndex format, blockIndex[0] = ' + JSON.stringify(blockIndex[0]));
    }
    let prevWallets = classes_1.createWalletsFromDTO(walletList);
    let blockDtos = responses;
    let blockTxsPairs = {};
    for (let i = 1; i < blockDtos.length; i++) {
        const dto = blockDtos[i];
        blockTxsPairs[dto.indep_hash] = dto.txs;
    }
    return {
        blockDtos,
        blockIndex,
        prevWallets,
        blockTxsPairs
    };
};
const pollForNewBlock = async (height) => {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    while (true) {
        let h = await arweave_cacher_1.default.getCurrentHeight();
        console.log('...timer got height ', h);
        if (h >= height) {
            return await arweave_cacher_1.default.getBlockDtoByHeight(height);
        }
        await sleep(20000);
    }
};
