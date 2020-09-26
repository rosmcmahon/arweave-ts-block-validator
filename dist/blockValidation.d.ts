import { ReturnCode, BlockIndexDTO, BlockTxsPairs } from './types';
import { Block } from './classes/Block';
import { WalletsObject } from './classes/WalletsObject';
export declare const validateBlock: (block: Block, prevBlock: Block, blockIndex: BlockIndexDTO, prevBlockWallets: WalletsObject, blockTxPairs: BlockTxsPairs) => Promise<ReturnCode>;
