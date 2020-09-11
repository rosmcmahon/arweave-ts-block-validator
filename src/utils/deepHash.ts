/**
 * This file is taken directly from https://github.com/ArweaveTeam/arweave-js/blob/2826fc8236e8dd995bccbca1429abd16c7bbb1bb/src/common/lib/deepHash.ts#L8
 */

import Arweave from 'arweave'

// In TypeScript 3.7, could be written as a single type:
// `type DeepHashChunk = Uint8Array | DeepHashChunk[];`
type DeepHashChunk = Uint8Array | DeepHashChunks;
interface DeepHashChunks extends Array<DeepHashChunk> {}

export default async function deepHash(data: DeepHashChunk): Promise<Uint8Array> {
  if (Array.isArray(data)) {
    const tag = Arweave.utils.concatBuffers([
      Arweave.utils.stringToBuffer("list"),
      Arweave.utils.stringToBuffer(data.length.toString())
    ]);

    return await deepHashChunks(
      data,
      await Arweave.crypto.hash(tag, "SHA-384")
    );
  }

  const tag = Arweave.utils.concatBuffers([
    Arweave.utils.stringToBuffer("blob"),
    Arweave.utils.stringToBuffer(data.byteLength.toString())
  ]);

  const taggedHash = Arweave.utils.concatBuffers([
    await Arweave.crypto.hash(tag, "SHA-384"),
    await Arweave.crypto.hash(data, "SHA-384")
  ]);

  return await Arweave.crypto.hash(taggedHash, "SHA-384");
}

async function deepHashChunks(chunks: DeepHashChunks, acc: Uint8Array): Promise<Uint8Array> {
  if (chunks.length < 1) {
    return acc;
  }

  const hashPair = Arweave.utils.concatBuffers([
    acc,
    await deepHash(chunks[0])
  ]);
  const newAcc = await Arweave.crypto.hash(hashPair, "SHA-384");
  return await deepHashChunks(chunks.slice(1), newAcc);
}
