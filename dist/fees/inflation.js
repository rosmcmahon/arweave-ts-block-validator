"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateInflation = void 0;
const decimal_js_1 = require("decimal.js");
const constants_1 = require("../constants");
exports.calculateInflation = (height) => {
    decimal_js_1.Decimal.config({ precision: 25 });
    let log2 = decimal_js_1.Decimal.ln(2);
    let years = new decimal_js_1.Decimal(height).dividedBy(constants_1.BLOCKS_PER_YEAR);
    let powerExp = decimal_js_1.Decimal.pow(2, -(years));
    let bigFloat = decimal_js_1.Decimal.mul(0.2, constants_1.GENESIS_TOKENS).mul(powerExp).mul(log2);
    if (constants_1.ADD_ERLANG_ROUNDING_ERROR) {
        return Number(bigFloat.mul(constants_1.WINSTON_PER_AR));
    }
};
