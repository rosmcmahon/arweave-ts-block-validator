/* Array of these gets fetched from a network node */
interface WalletListEntry {
	address: string
	balance: string //integer in string format
	last_tx: string
}

export type WalletListDTO = WalletListEntry[]
