import { WalletListDTO } from "../types";

export interface WalletsObject {
	[address: string]: {
		balance: bigint
		last_tx: string
	}
}

export const createWalletsFromDTO = (walletList: WalletListDTO[]) => {
	let walletsObj: WalletsObject = {}
	for (let i = 0; i < walletList.length; i++) {
		const entry = walletList[i]
		walletsObj[entry.address] = {balance: BigInt(entry.balance), last_tx: entry.last_tx}
	}
	return walletsObj
}