/**
 * This file is based on https://github.com/ArweaveTeam/arweave-js/blob/master/src/common/lib/merkle.ts
 * 
 * Some changes made.
 * - Extra data output from validatePath
 * - Takes an array of type MerkleElement and generates tree from this
 * - All datas changed to bigints for tree generation
 * - Removed all references to Chunked data
 */
import Arweave from "arweave";
import { bigIntToBuffer256, arrayCompare, bufferToBigInt } from "./buffer-utilities";


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

type MerkelNode = BranchNode | LeafNode;

const NOTE_SIZE = 32;
const HASH_SIZE = 32;


async function generateLeaves(elements: MerkleElement[]): Promise<LeafNode[]> {
  return Promise.all(
    elements.map(
      async ({ data, note }): Promise<LeafNode> => {
        return {
          type: "leaf",
          id: await hash(
            await Promise.all([hash(data), hash(bigIntToBuffer256(note))])
          ),
          dataHash: data,
          note: note,
          maxByteRange: note,
        };
      }
    )
  );
}

/**
 * Builds an arweave merkle tree and gets the root hash for the given input.
 */
export async function computeRootHash(elements: MerkleElement[]): Promise<Uint8Array> {
  const rootNode = await generateTree(elements);

  return rootNode.id;
}

export async function generateTree(elements: MerkleElement[]): Promise<MerkelNode> {
  const rootNode = await buildLayers(
    await generateLeaves(elements)
  );

  return rootNode;
}


/**
 * Starting with the bottom layer of leaf nodes, hash every second pair
 * into a new branch node, push those branch nodes onto a new layer,
 * and then recurse, building up the tree to it's root, where the
 * layer only consists of two items.
 */
async function buildLayers(
  nodes: MerkelNode[],
  level = 0
): Promise<MerkelNode> {
  // If there are only 2 nodes left, this is going to be the root node
  if (nodes.length < 2) {
    const root = await hashBranch(nodes[0], nodes[1]);

    return root;
  }

  const nextLayer: MerkelNode[] = [];

  for (let i = 0; i < nodes.length; i += 2) {
    nextLayer.push(await hashBranch(nodes[i], nodes[i + 1]));
  }

  return buildLayers(nextLayer, level + 1);
}

/**
 * Recursively search through all branches of the tree,
 * and generate a proof for each leaf node.
 */
export function generateProofs(root: MerkelNode) {
  const proofs = resolveBranchProofs(root);
  if (!Array.isArray(proofs)) {
    return [proofs];
  }
  return arrayFlatten<Proof>(proofs);
}

interface Proof {
  offset: bigint;
  proof: Uint8Array;
}

function resolveBranchProofs(
  node: MerkelNode,
  proof: Uint8Array = new Uint8Array(),
  depth = 0
): Proof | Proof[] {
  if (node.type == "leaf") {
    return {
      offset: node.maxByteRange - 1n,
      proof: Arweave.utils.concatBuffers([
        proof,
        node.dataHash,
        bigIntToBuffer256(node.maxByteRange)
      ])
    };
  }

  if (node.type == "branch") {
    const partialProof = Arweave.utils.concatBuffers([
      proof,
      node.leftChild!.id!,
      node.rightChild!.id!,
      bigIntToBuffer256(node.byteRange)
    ]);
    return [
      resolveBranchProofs(node.leftChild!, partialProof, depth + 1),
      resolveBranchProofs(node.rightChild!, partialProof, depth + 1)
    ] as [Proof, Proof];
  }

  throw new Error(`Unexpected node type`);
}

export function arrayFlatten<T = any>(input: T[]): T[] {
  const flat: any[] = [];

  input.forEach(item => {
    if (Array.isArray(item)) {
      flat.push(...arrayFlatten(item));
    } else {
      flat.push(item);
    }
  });

  return flat;
}

async function hashBranch(
  left: MerkelNode,
  right: MerkelNode
): Promise<MerkelNode> {
  if (!right) {
    return left as BranchNode;
  }
  let branch = {
    type: "branch",
    id: await hash([
      await hash(left.id),
      await hash(right.id),
      await hash(bigIntToBuffer256(left.maxByteRange))
    ]),
    byteRange: left.maxByteRange,
    maxByteRange: right.maxByteRange,
    leftChild: left,
    rightChild: right
  } as BranchNode;

  return branch;
}

async function hash(data: Uint8Array | Uint8Array[]) {
  if (Array.isArray(data)) {
    data = Arweave.utils.concatBuffers(data);
  }

  return new Uint8Array(await Arweave.crypto.hash(data));
}


export async function validatePath(
  id: Uint8Array, dest: bigint, leftBound: bigint, rightBound: bigint, path: Uint8Array
): Promise<
  | false
  | { data: Uint8Array; offset: bigint; leftBound: bigint; rightBound: bigint; chunkSize: bigint }
> {
  if (rightBound <= 0n) {
    return false;
  }

  if (dest >= rightBound) {
    return validatePath(id, 0n, rightBound - 1n, rightBound, path);
  }

  if (dest < 0n) {
    return validatePath(id, 0n, 0n, rightBound, path);
  }

  if (path.length == HASH_SIZE + NOTE_SIZE) {
    const pathData = path.slice(0, HASH_SIZE);
    const endOffsetBuffer = path.slice(
      pathData.length,
      pathData.length + NOTE_SIZE
    );

    const pathDataHash = await hash([
      await hash(pathData),
      await hash(endOffsetBuffer)
    ]);
    let result = arrayCompare(id, pathDataHash);
    if (result) {
      return {
        data: pathData,
        offset: rightBound - 1n,
        leftBound: leftBound,
        rightBound: rightBound,
        chunkSize: rightBound - leftBound
      };
    }
    return false;
  }

  const left = path.slice(0, HASH_SIZE);
  const right = path.slice(left.length, left.length + HASH_SIZE);
  const offsetBuffer = path.slice(
    left.length + right.length,
    left.length + right.length + NOTE_SIZE
  );
  const offset = bufferToBigInt(offsetBuffer);

  const remainder = path.slice(
    left.length + right.length + offsetBuffer.length
  );

  const pathHash = await hash([
    await hash(left),
    await hash(right),
    await hash(offsetBuffer)
  ]);

  if (arrayCompare(id, pathHash)) {
    if (dest < offset) {
      return await validatePath(
        left,
        dest,
        leftBound,
        /*Math.min*/(rightBound < offset) ? rightBound : offset,
        remainder
      );
    }
    return await validatePath(
      right,
      dest,
      /*Math.max*/(leftBound > offset) ? rightBound: offset,
      rightBound,
      remainder
    );
  }

  return false;
}

