export interface MerkleElement {
    data: Uint8Array;
    note: bigint;
}
interface BranchNode {
    readonly id: Uint8Array;
    readonly type: "branch";
    readonly byteRange: bigint;
    readonly maxByteRange: bigint;
    readonly leftChild?: MerkelNode;
    readonly rightChild?: MerkelNode;
}
interface LeafNode {
    readonly id: Uint8Array;
    readonly dataHash: Uint8Array;
    readonly type: "leaf";
    readonly note: bigint;
    readonly maxByteRange: bigint;
}
declare type MerkelNode = BranchNode | LeafNode;
export declare function computeRootHash(elements: MerkleElement[]): Promise<Uint8Array>;
export declare function generateTree(elements: MerkleElement[]): Promise<MerkelNode>;
export declare function generateProofs(root: MerkelNode): Proof[];
interface Proof {
    offset: bigint;
    proof: Uint8Array;
}
export declare function arrayFlatten<T = any>(input: T[]): T[];
export declare function validatePath(id: Uint8Array, dest: bigint, leftBound: bigint, rightBound: bigint, path: Uint8Array): Promise<false | {
    data: Uint8Array;
    offset: bigint;
    leftBound: bigint;
    rightBound: bigint;
    chunkSize: bigint;
}>;
export {};
