// This is the host used for retieving block data 
export const HOST_SERVER = 'http://eu-west-1.arweave.net:1984'

export const ADD_ERLANG_ROUNDING_ERROR = true // need to add rounding error to match erlang

// The value of last_tx if the wallet never spent AR before
export const WALLET_NEVER_SPENT = ''

export const STORE_BLOCKS_AROUND_CURRENT = 50

// The maximum size of a single POST body.
export const MAX_BODY_SIZE =  15 * 1024 * 1024 // future use in http api

// The maximum allowed size in bytes for the data field of a format=1 transaction.
export const TX_DATA_SIZE_LIMIT = 10 * 1024 * 1024

//Byte size of the TX headers, tags allowance, etc.
export const TX_SIZE_BASE = 3210n

// The maximum number of transactions (both format=1 and format=2) in a block.
export const BLOCK_TX_COUNT_LIMIT = 1000 
// The maximum allowed size in bytes for the combined data fields of the format=1 transactions included in a block.
export const BLOCK_TX_DATA_SIZE_LIMIT = TX_DATA_SIZE_LIMIT // Must be greater or equal to tx data size limit.

// Defines Arweave hard forks' heights.
export const FORK_HEIGHT_1_7 = 235200
export const FORK_HEIGHT_1_8 = 269510
export const FORK_HEIGHT_1_9 = 315700
export const FORK_HEIGHT_2_0 = 422250
export const FORK_HEIGHT_2_2 = 500000

export const POA_MIN_MAX_OPTION_DEPTH = 100


// Mining difficulty and retarget constants
// The adjustment of difficutly going from SHA-384 to RandomX
// export const RANDOMX_DIFF_ADJUSTMENT = -14n //removed
// export const MIN_SHA384_DIFFICULTY = 31n //removed
//export const MIN_RANDOMX_DIFFICULTY = 17n // MIN_SHA384_DIFFICULTY + RANDOMX_DIFF_ADJUSTMENT //removed
export const DEFAULT_DIFF = 8n
export const RETARGET_BLOCKS = 10
export const TARGET_TIME = 120
export const RETARGET_TOLERANCE_FLOAT = 0.1 // remove?
// *New mining difficulty constants *
export const RETARGET_BLOCK_TIME = 1200n // RETARGET_BLOCKS * TARGET_TIME
export const NEW_RETARGET_TOLERANCE = 120n // RETARGET_TOLERANCE_FLOAT * RETARGET_BLOCKS_BY_TARGET_TIME
// MAX_DIFF is 2^256
export const MAX_DIFF = 115792089237316195423570985008687907853269984665640564039457584007913129639936n
// MIN_DIFF_FORK_1_8 comes from erlang function ar_retarget:switch_to_linear_diff(MIN_RANDOMX_DIFFICULTY), which is a constant = ( (2n ** 256n) - (2n ** (256n - MIN_RANDOMX_DIFFICULTY)) ) 
export const MIN_DIFF_FORK_1_8 = 115791205813783806231406193359937536394012070923692126229978523204812483330048n

// Max allowed difficulty multiplication and division factors.
// The adjustment is lower when the difficulty goes down than when
// it goes up to prevent forks - stalls are preferred over forks.
export const DIFF_ADJUSTMENT_DOWN_LIMIT = 2
export const DIFF_ADJUSTMENT_UP_LIMIT = 4
export const DIFF_ADJUSTMENT_UP_COMPARATOR = 300n // RETARGET_BLOCK_TIME/DIFF_ADJUSTMENT_UP_LIMIT
export const DIFF_ADJUSTMENT_DOWN_COMPARATOR = 2400n // RETARGET_BLOCK_TIME * DIFF_ADJUSTMENT_DOWN_LIMIT

// The number of blocks that pass before RandomX key changes again
export const RANDOMX_KEY_SWAP_FREQ = 2000

/* Inflation constants */

// The total supply of tokens in the Genesis block,
export const GENESIS_TOKENS = 55000000
// Winstons per AR.
export const WINSTON_PER_AR = 1000000000000
export const BLOCKS_PER_YEAR = 262800 // 30 * 24 * 365
// The base cost of a byte in AR
export const BASE_BYTES_PER_AR = 10000000
// Base wallet generation fee
export const WALLET_GEN_FEE = 250000000000n
// The minimum cost per byte for a single TX.
export const COST_PER_BYTE = 100000 //(WINSTON_PER_AR div BASE_BYTES_PER_AR)

/* Perpetual storage constants */

export const N_REPLICATIONS = 10 
// How much harder it should be to mine each subsequent alternative POA option.
export const ALTERNATIVE_POA_DIFF_MULTIPLIER = 2

// Mining reward as a proportion of tx cost.
export const MINING_REWARD_MULTIPLIER = 0.2
export const MINING_REWARD_DIVIDER = 5n //better to integer divide a final calculation
export const MINING_REWARD_DIVIDER_MODIFIED = 6n //ref: calculateRewardPoolPerpetual
// Figures taken from the "date-GBh spreadsheet" see: perpetual_storage.hrl
export const USD_PER_GBY_2018 = 0.001045
export const USD_PER_GBY_2019 = 0.000925
// Decay rate of the storage cost in GB/year.
export const USD_PER_GBY_DECAY_ANNUAL = 0.995 // i.e. 0.5% annual decay rate
// The network height at the time when 
// the $/AR exchange rate was INITIAL_USD_PER_AR.
export const INITIAL_USD_PER_AR_HEIGHT = FORK_HEIGHT_2_2
export const INITIAL_USD_PER_AR_DIFF = 33n
export const INITIAL_USD_PER_AR = 2 //ref: perpetual_storage.hrl

/* Block field size limits */

// Max size of a single data chunk, in bytes.
export const DATA_CHUNK_SIZE = 256 * 1024
// Max size of the PoA data path, in bytes.
export const MAX_PATH_SIZE = 256 * 1024
// The size of data chunk hashes, in bytes.
export const CHUNK_ID_HASH_SIZE = 32
