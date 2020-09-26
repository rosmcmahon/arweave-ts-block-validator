import { Block } from './classes/Block';
import { Tx } from './classes/Tx';
import { WalletsObject } from './classes/WalletsObject';
export declare const nodeUtils_IsWalletInvalid: (tx: Tx, wallets: WalletsObject) => Promise<boolean>;
export declare const updateWalletsWithBlockTxs: (block: Block, wallets: WalletsObject, rewardPool: bigint, height: number) => Promise<{
    newRewardPool: bigint;
    wallets: WalletsObject;
}>;
export declare const applyTxToWalletsObject: (wallets: WalletsObject, tx: Tx) => Promise<void>;
