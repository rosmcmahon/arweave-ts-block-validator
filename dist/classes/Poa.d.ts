import { BlockIndexDTO } from "../types";
export interface Poa {
    option: number;
    tx_path: Uint8Array;
    data_path: Uint8Array;
    chunk: Uint8Array;
}
export declare const validatePoa: (prevIndepHash: Uint8Array, prevWeaveSize: bigint, blockIndex: BlockIndexDTO, poa: Poa) => Promise<Boolean>;
export declare const findPoaChallengeBlock: (byte: bigint, blockIndex: BlockIndexDTO) => {
    txRoot: Uint8Array;
    blockBase: bigint;
    blockTop: bigint;
    bh: Uint8Array;
};
export declare const poa_modifyDiff: (diff: bigint, option: number) => bigint;
