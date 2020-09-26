import { Tag } from '../Tag';
export declare class BlockDTO {
    nonce: string;
    previous_block: string;
    timestamp: number;
    last_retarget: number;
    diff: string;
    height: number;
    hash: string;
    indep_hash: string;
    txs: string[];
    tx_root: string;
    tx_tree: string[];
    wallet_list: string;
    reward_addr: string;
    tags: Tag[];
    reward_pool: number;
    weave_size: number;
    block_size: number;
    cumulative_diff: string;
    hash_list_merkle: string;
    poa: PoaDTO;
}
declare class PoaDTO {
    option: string;
    tx_path: string;
    data_path: string;
    chunk: string;
}
export {};
