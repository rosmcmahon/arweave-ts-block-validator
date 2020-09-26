"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMiningDifficulty = void 0;
const constants_1 = require("../constants");
const buffer_utilities_1 = require("../utils/buffer-utilities");
exports.validateMiningDifficulty = (bdsHash, diff, height) => {
    if (height < constants_1.FORK_HEIGHT_1_8) {
        throw new Error("validateMiningDifficulty not implemented for < FORK_HEIGHT_1_8");
    }
    return buffer_utilities_1.bufferToBigInt(bdsHash) > diff;
};
