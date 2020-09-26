import { TxDTO } from "../types";
import { JWKInterface } from "arweave/node/lib/wallet";
interface Tag {
    name: string;
    value: string;
}
export declare class Tx {
    format: number;
    idString: string;
    id: Uint8Array;
    last_tx: Uint8Array;
    owner: Uint8Array;
    tags: Tag[];
    target: string;
    quantity: bigint;
    data: Uint8Array;
    data_size: bigint;
    data_tree: Uint8Array[];
    private data_root;
    signature: Uint8Array;
    reward: bigint;
    constructor(dto: TxDTO);
    static getByIdString(txid: string): Promise<Tx>;
    static getById(txid: Uint8Array): Promise<Tx>;
    getDataRoot(): Promise<Uint8Array>;
    private getSignatureData;
    verify(): Promise<boolean>;
    sign(jwk: JWKInterface): Promise<void>;
}
export declare const generateV1TxDataRoot: (tx: Tx) => Promise<Uint8Array>;
export {};
