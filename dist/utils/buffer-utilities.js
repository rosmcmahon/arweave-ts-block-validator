"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bufferToInt = exports.intToBuffer256 = exports.arrayCompare = exports.bufferToBigInt = exports.bigIntToBuffer256 = void 0;
function bigIntToBuffer256(num) {
    const buffer = new Uint8Array(32);
    for (var i = buffer.length - 1; i >= 0; i--) {
        var byte = num % 256n;
        buffer[i] = Number(byte);
        num = (num - byte) / 256n;
    }
    return buffer;
}
exports.bigIntToBuffer256 = bigIntToBuffer256;
function bufferToBigInt(buffer) {
    let value = 0n;
    for (var i = 0; i < buffer.length; i++) {
        value *= 256n;
        value = value + BigInt(buffer[i]);
    }
    return value;
}
exports.bufferToBigInt = bufferToBigInt;
exports.arrayCompare = (a, b) => {
    return a.every((value, index) => b[index] === value);
};
function intToBuffer256(note) {
    const buffer = new Uint8Array(32);
    for (var i = buffer.length - 1; i >= 0; i--) {
        var byte = note % 256;
        buffer[i] = byte;
        note = (note - byte) / 256;
    }
    return buffer;
}
exports.intToBuffer256 = intToBuffer256;
function bufferToInt(buffer) {
    let value = 0;
    for (var i = 0; i < buffer.length; i++) {
        value *= 256;
        value += buffer[i];
    }
    return value;
}
exports.bufferToInt = bufferToInt;
