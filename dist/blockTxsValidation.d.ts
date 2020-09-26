import { Tx } from "./classes/Tx";
import { BlockTxsPairs, ReturnCode } from "./types";
import { WalletsObject } from "./classes/WalletsObject";
export declare const validateBlockTxs: (txs: Tx[], diff: bigint, height: number, timestamp: bigint, prevBlockWallets: WalletsObject, blockTxsPairs: BlockTxsPairs) => Promise<ReturnCode>;
export declare const verifyTx: (tx: Tx, diff: bigint, height: number, timestamp: bigint, wallets: WalletsObject) => Promise<ReturnCode>;
