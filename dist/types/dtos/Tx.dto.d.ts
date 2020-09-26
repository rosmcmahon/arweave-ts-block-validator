export declare class TxDTO {
    format: number;
    id: string;
    last_tx: string;
    owner: string;
    tags: Tag[];
    target: string;
    quantity: number;
    data: string;
    data_size: string;
    data_tree: string[];
    data_root: string;
    signature: string;
    reward: string;
}
interface Tag {
    name: string;
    value: string;
}
export {};
