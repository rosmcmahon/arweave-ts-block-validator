import { WalletListDTO } from "../types";
export interface WalletsObject {
    [address: string]: {
        balance: bigint;
        last_tx: string;
    };
}
export declare const createWalletsFromDTO: (walletList: WalletListDTO) => WalletsObject;
