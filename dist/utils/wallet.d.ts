import { JWKInterface } from 'arweave/node/lib/wallet';
export declare const wallet_ownerToAddressString: (pubkey: Uint8Array) => Promise<string>;
export declare const wallet_jwkToAddressString: (jwk: JWKInterface) => Promise<string>;
