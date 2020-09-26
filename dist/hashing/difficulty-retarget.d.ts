import { Block } from '../classes/Block';
export declare const switchToLinearDiff: (diff: bigint) => bigint;
export declare const validateDifficulty: (block: Block, prevBlock: Block) => boolean;
export declare const multiplyDifficulty: (diff: bigint, multiplier: number) => bigint;
