"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.multiplyDifficulty = exports.validateDifficulty = exports.switchToLinearDiff = void 0;
const constants_1 = require("../constants");
const decimal_js_1 = require("decimal.js");
exports.switchToLinearDiff = (diff) => {
    return ((2n ** 256n) - (2n ** (256n - diff)));
};
exports.validateDifficulty = (block, prevBlock) => {
    if ((block.height % constants_1.RETARGET_BLOCKS === 0) && (block.height !== 0)) {
        let calculated = calculateDifficulty(prevBlock.diff, block.timestamp, prevBlock.last_retarget, block.height);
        return Number(block.diff) === Number(calculated);
    }
    return (block.diff === prevBlock.diff) && (block.last_retarget === prevBlock.last_retarget);
};
const calculateDifficulty = (oldDiff, ts, last, height) => {
    if (height <= constants_1.FORK_HEIGHT_1_8) {
        throw new Error('retargetCalculateDifficulty for height <= FORK_HEIGHT_1_8 not implemented');
    }
    return calculateDifficultyLinear(oldDiff, ts, last, height);
};
const calculateDifficultyLinearALGEBRA = (oldDiff, ts, last, height) => {
    if (height < constants_1.FORK_HEIGHT_1_9) {
        throw new Error("ar_retarget:calculate_difficulty_legacy not implemented");
    }
    let actualTime = ts - last;
    let newExpr = (constants_1.RETARGET_BLOCK_TIME - actualTime);
    if (newExpr < 0) {
        newExpr = -newExpr;
    }
    if (newExpr < constants_1.NEW_RETARGET_TOLERANCE) {
        return oldDiff;
    }
    let diffInverse;
    const between2 = (maxLessDiffInverse) => {
        if (maxLessDiffInverse < constants_1.MIN_DIFF_FORK_1_8) {
            return constants_1.MIN_DIFF_FORK_1_8;
        }
        if (maxLessDiffInverse > constants_1.MAX_DIFF) {
            return constants_1.MAX_DIFF;
        }
        return maxLessDiffInverse;
    };
    if (actualTime < constants_1.DIFF_ADJUSTMENT_UP_COMPARATOR) {
        let maxLessDiffInverse = ((3n * constants_1.MAX_DIFF) + oldDiff) >> 2n;
        return between2(maxLessDiffInverse);
    }
    if (actualTime > constants_1.DIFF_ADJUSTMENT_DOWN_COMPARATOR) {
        let maxLessDiffInverse = 2n * oldDiff - constants_1.MAX_DIFF;
        return between2(maxLessDiffInverse);
    }
    let maxLessDiffInverse = ((constants_1.RETARGET_BLOCK_TIME - actualTime) * constants_1.MAX_DIFF + actualTime * oldDiff) / constants_1.RETARGET_BLOCK_TIME;
    return between2(maxLessDiffInverse);
};
const calculateDifficultyLinear = (oldDiff, ts, last, height) => {
    if (height < constants_1.FORK_HEIGHT_1_9) {
        throw new Error("ar_retarget:calculate_difficulty_legacy not implemented");
    }
    decimal_js_1.Decimal.config({ precision: 100 });
    let targetTime = new decimal_js_1.Decimal(constants_1.RETARGET_BLOCKS * constants_1.TARGET_TIME);
    let actualTime = new decimal_js_1.Decimal((ts - last).toString());
    let timeDelta = actualTime.dividedBy(targetTime);
    let oneMinusTimeDelta = new decimal_js_1.Decimal(1).minus(timeDelta).abs();
    let targetTimeFLOAT = constants_1.RETARGET_BLOCKS * constants_1.TARGET_TIME;
    let actualTimeFLOAT = Number(ts - last);
    let timeDeltaFLOAT = actualTimeFLOAT / targetTimeFLOAT;
    let oneMinusTimeDeltaFLOAT = Math.abs(1 - timeDeltaFLOAT);
    if (constants_1.ADD_ERLANG_ROUNDING_ERROR && (Number(oneMinusTimeDelta) < constants_1.RETARGET_TOLERANCE_FLOAT)) {
        return oldDiff;
    }
    else if (!constants_1.ADD_ERLANG_ROUNDING_ERROR && oneMinusTimeDelta.lessThan(constants_1.RETARGET_TOLERANCE_FLOAT)) {
        return oldDiff;
    }
    let effectiveTimeDelta = betweenDecimals(timeDelta, new decimal_js_1.Decimal(1).dividedBy(constants_1.DIFF_ADJUSTMENT_UP_LIMIT), new decimal_js_1.Decimal(constants_1.DIFF_ADJUSTMENT_DOWN_LIMIT));
    let effectiveTimeDeltaFLOAT = timeDeltaFLOAT < 0.25 ? 0.25 : timeDeltaFLOAT;
    effectiveTimeDeltaFLOAT = timeDeltaFLOAT > 2 ? 2 : timeDeltaFLOAT;
    let diffInverseFLOAT = (Number(constants_1.MAX_DIFF - oldDiff) * effectiveTimeDeltaFLOAT);
    let diffInverse = new decimal_js_1.Decimal((constants_1.MAX_DIFF - oldDiff).toString()).mul(effectiveTimeDelta);
    let diffInverseInt;
    if (constants_1.ADD_ERLANG_ROUNDING_ERROR) {
        diffInverseInt = BigInt(Number(diffInverse));
    }
    else {
        diffInverseInt = BigInt(diffInverse);
    }
    let returnValue = betweenBigInts(constants_1.MAX_DIFF - diffInverseInt, constants_1.MIN_DIFF_FORK_1_8, constants_1.MAX_DIFF);
    return returnValue;
};
const betweenBigInts = (num, min, max) => {
    if (num < min)
        return min;
    if (num > max)
        return max;
    return num;
};
const betweenDecimals = (num, min, max) => {
    if (num.lessThan(min))
        return min;
    if (num.greaterThan(max))
        return max;
    return num;
};
exports.multiplyDifficulty = (diff, multiplier) => {
    let mult = BigInt(multiplier);
    let modifier = ((1n / mult) * (constants_1.MAX_DIFF - diff));
    return constants_1.MAX_DIFF - modifier;
};
