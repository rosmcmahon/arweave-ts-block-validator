"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.txPerpetualStorage_calculateTxFee = exports.txPerpetualStorage_getCostPerBlockAtTimestamp = exports.txPerpetualStorage_usdToAr = void 0;
const constants_1 = require("../constants");
const decimal_js_1 = require("decimal.js");
const difficulty_retarget_1 = require("../hashing/difficulty-retarget");
const inflation_1 = require("./inflation");
exports.txPerpetualStorage_usdToAr = (usd, diff, height) => {
    if (height < constants_1.FORK_HEIGHT_1_9)
        throw new Error("txPerpetualStorageUsdToAr not impleneted for height < FORK_HEIGHT_1_9");
    decimal_js_1.Decimal.config({ precision: 50 });
    let initialDiff = difficulty_retarget_1.switchToLinearDiff(constants_1.INITIAL_USD_PER_AR_DIFF);
    let deltaP = (constants_1.MAX_DIFF - initialDiff) / (constants_1.MAX_DIFF - diff);
    let initialInflation = new decimal_js_1.Decimal(inflation_1.calculateInflation(constants_1.INITIAL_USD_PER_AR_HEIGHT));
    let deltaInflation = new decimal_js_1.Decimal(inflation_1.calculateInflation(height)).dividedBy(initialInflation);
    let retNumerator = new decimal_js_1.Decimal(usd).mul(constants_1.WINSTON_PER_AR).mul(deltaInflation);
    let retDenominator = new decimal_js_1.Decimal((BigInt(constants_1.INITIAL_USD_PER_AR_HEIGHT) * deltaP).toString());
    let retValue = retNumerator.dividedBy(retDenominator);
    if (constants_1.ADD_ERLANG_ROUNDING_ERROR) {
        return BigInt(Math.floor(Number(retValue)));
    }
    return BigInt(retValue.floor());
};
exports.txPerpetualStorage_getCostPerBlockAtTimestamp = (ts) => {
    let dateTime = new Date(Number(ts) * 1000);
    return getCostPerYearAtDatetime(dateTime) / (constants_1.BLOCKS_PER_YEAR);
};
const getCostPerYearAtDatetime = (dateTime) => {
    decimal_js_1.Decimal.config({ precision: 100 });
    let year = dateTime.getUTCFullYear();
    let month = dateTime.getUTCMonth();
    let prevYear = prev_jun_30_year(year, month);
    let nextYear = next_jun_30_year(year, month);
    let fracYear = new decimal_js_1.Decimal(fraction_of_year(prevYear, nextYear, dateTime));
    let prevYearCost = new decimal_js_1.Decimal(usd_p_gby(prevYear));
    let nextYearCost = new decimal_js_1.Decimal(usd_p_gby(nextYear));
    let cy = prevYearCost.minus((prevYearCost.minus(nextYearCost)).mul(fracYear));
    if (constants_1.ADD_ERLANG_ROUNDING_ERROR) {
        return Number(cy.mul(constants_1.N_REPLICATIONS));
    }
};
const prev_jun_30_year = (y, m) => {
    if (m < 6)
        return y - 1;
    return y;
};
const next_jun_30_year = (y, m) => {
    if (m < 6)
        return y;
    return y + 1;
};
const fraction_of_year = (prevYear, nextYear, datetime) => {
    decimal_js_1.Decimal.config({ precision: 100 });
    let start = (new Date(prevYear, 5, 30, 23, 59, 59)).getTime();
    let end = new Date(nextYear, 5, 30, 23, 59, 59).getTime();
    let now = datetime.getTime();
    if (constants_1.ADD_ERLANG_ROUNDING_ERROR) {
        return Number(new decimal_js_1.Decimal(now - start).dividedBy(end - start));
    }
};
const usd_p_gby = (y) => {
    decimal_js_1.Decimal.config({ precision: 100 });
    if (y === 2018)
        return new decimal_js_1.Decimal(constants_1.USD_PER_GBY_2018);
    if (y === 2019)
        return new decimal_js_1.Decimal(constants_1.USD_PER_GBY_2019);
    let k = new decimal_js_1.Decimal(constants_1.USD_PER_GBY_2019);
    let a = decimal_js_1.Decimal.ln(constants_1.USD_PER_GBY_DECAY_ANNUAL);
    let t = y - 2019;
    if (constants_1.ADD_ERLANG_ROUNDING_ERROR) {
        return Number(k.mul(decimal_js_1.Decimal.exp(a.mul(t))));
    }
};
exports.txPerpetualStorage_calculateTxFee = (size, diff, height, timestamp) => {
    let txCost = calculateTxCost(size, diff, height, timestamp);
    let txReward = txCost / constants_1.MINING_REWARD_DIVIDER;
    return txCost + txReward;
};
const calculateTxCost = (size, diff, height, timestamp) => {
    if (height < constants_1.FORK_HEIGHT_1_9)
        throw new Error("calculate_tx_cost not supported below FORK_HEIGHT_1_9");
    let bytes = constants_1.TX_SIZE_BASE + size;
    let perGb = exports.txPerpetualStorage_usdToAr(perpetualCostAtTimestamp(timestamp), diff, height);
    return (2n * perGb * bytes) / (1024n ** 3n);
};
const perpetualCostAtTimestamp = (timestamp) => {
    let k = new decimal_js_1.Decimal(getCostPerYearAtTimestamp(timestamp));
    return Number(k.dividedBy(decimal_js_1.Decimal.ln(constants_1.USD_PER_GBY_DECAY_ANNUAL)).negated());
};
const getCostPerYearAtTimestamp = (ts) => {
    let dateTime = new Date(Number(ts) * 1000);
    return getCostPerYearAtDatetime(dateTime);
};
