"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWalletsFromDTO = void 0;
exports.createWalletsFromDTO = (walletList) => {
    let walletsObj = {};
    for (let i = 0; i < walletList.length; i++) {
        const entry = walletList[i];
        walletsObj[entry.address] = { balance: BigInt(entry.balance), last_tx: entry.last_tx };
    }
    return walletsObj;
};
