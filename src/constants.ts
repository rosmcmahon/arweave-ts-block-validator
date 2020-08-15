

// NB: Setting the default difficulty high will cause TNT to fail.
export const DEFAULT_DIFF = 8


export const STORE_BLOCKS_BEHIND_CURRENT = 50

// The maximum size of a single POST body.
export const MAX_BODY_SIZE =  15 * 1024 * 1024

// The maximum allowed size in bytes for the data field of a format=1 transaction.
export const TX_DATA_SIZE_LIMIT = 10 * 1024 * 1024

// The maximum allowed size in bytes for the combined data fields of the format=1 transactions included in a block.
export const BLOCK_TX_DATA_SIZE_LIMIT = TX_DATA_SIZE_LIMIT // Must be greater or equal to tx data size limit.

// The maximum number of transactions (both format=1 and format=2) in a block.
export const BLOCK_TX_COUNT_LIMIT = (process.env.NODE_ENV !== "production") ? 10 : 1000 //might need to manually set this with nestjs

