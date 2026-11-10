import {encodeAbiParameters, getAddress, isHex, keccak256, toHex} from 'viem';

/** A 32-byte random recovery code. Never use a memorable password directly. */
export function newSecret() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/** Compute locally; never ask a public RPC endpoint to hash the secret. */
export function noteCommitment(secret, recipient, vault, chainId) {
  if (!isHex(secret) || secret.length !== 66) throw new Error('Expected a 32-byte secret');
  return keccak256(encodeAbiParameters(
    [{type:'bytes32'},{type:'address'},{type:'address'},{type:'uint256'}],
    [secret, getAddress(recipient), getAddress(vault), BigInt(chainId)]
  ));
}
