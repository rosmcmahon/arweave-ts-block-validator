/* Array of these gets fetched from a network node */
export interface WalletListDTO {
	address: string
	balance: string //integer in string format
	last_tx: string
}