import Arweave from 'arweave'
import { JWKInterface } from 'arweave/node/lib/wallet'

// %% @doc Generate an address from a public key.
// to_address(Addr) when ?IS_ADDR(Addr) -> Addr;
// to_address({{_, Pub}, Pub}) -> to_address(Pub);
// to_address({_, Pub}) -> to_address(Pub);
// to_address(PubKey) ->
// 	crypto:hash(?HASH_ALG, PubKey).

// %% @doc A Macro to return whether a value is an address.
// -define(IS_ADDR(Addr), (is_binary(Addr) and (bit_size(Addr) == ?HASH_SZ))).

// -define(HASH_SZ, 256).

export const walletOwnerToAddressString = async (pubkey: Uint8Array) => {
	return Arweave.utils.bufferTob64Url( await Arweave.crypto.hash(pubkey) )
}

export const walletJwkToAddressString = async (jwk: JWKInterface) => {
	return Arweave.utils.bufferTob64Url( 
		await Arweave.crypto.hash( 
			Arweave.utils.stringToBuffer(jwk.n) 
		) 
	)
}
