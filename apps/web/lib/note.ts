import { encodeAbiParameters, keccak256, parseAbiParameters, type Address, type Hex } from 'viem';
import { BASE_CHAIN_ID, SPLIT_POOL_VAULT } from './contracts';

/** A one-time code is 32 random bytes, encoded as 0x + 64 hex characters. */
export const CODE_PATTERN = /^0x[0-9a-fA-F]{64}$/;

/**
 * Generates the one-time withdrawal code in the browser.
 * Uses the Web Crypto API. The code never leaves the browser unless the user shares it.
 */
export function generateCode(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ('0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')) as Hex;
}

/**
 * Commitment stored on-chain: keccak256(code, recipient, vault, chainId).
 * Must match SplitPoolVault.redeem, which recomputes the same value.
 */
export function commitmentFor(code: Hex, recipient: Address): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('bytes32, address, address, uint256'), [
      code,
      recipient,
      SPLIT_POOL_VAULT,
      BigInt(BASE_CHAIN_ID),
    ]),
  );
}
