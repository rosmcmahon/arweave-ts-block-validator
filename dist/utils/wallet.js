"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wallet_jwkToAddressString = exports.wallet_ownerToAddressString = void 0;
const arweave_1 = __importDefault(require("arweave"));
exports.wallet_ownerToAddressString = async (pubkey) => {
    return arweave_1.default.utils.bufferTob64Url(await arweave_1.default.crypto.hash(pubkey));
};
exports.wallet_jwkToAddressString = async (jwk) => {
    return arweave_1.default.utils.bufferTob64Url(await arweave_1.default.crypto.hash(arweave_1.default.utils.b64UrlToBuffer(jwk.n)));
};
