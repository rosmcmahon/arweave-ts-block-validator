import Arweave from 'arweave'
import { JWKInterface } from 'arweave/node/lib/wallet'


export const wallet_ownerToAddressString = async (pubkey: Uint8Array) => {
	return Arweave.utils.bufferTob64Url( await Arweave.crypto.hash(pubkey) )
}

export const wallet_jwkToAddressString = async (jwk: JWKInterface) => {
	return Arweave.utils.bufferTob64Url( 
		await Arweave.crypto.hash( 
			Arweave.utils.b64UrlToBuffer(jwk.n) 
		) 
	)
}
