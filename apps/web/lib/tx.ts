import type { Hash, PublicClient } from 'viem';
import { basescanTx } from './contracts';

export type TxPhase = 'idle' | 'signing' | 'pending' | 'success' | 'error';

export type TxState = {
  phase: TxPhase;
  /** Short action name shown to the user, for example "Deposit" or "Approve AAPLc". */
  label?: string;
  hash?: Hash;
  message?: string;
};

export const IDLE: TxState = { phase: 'idle' };

/**
 * Waits for a transaction to be mined and confirmed twice.
 * Throws if the chain reverts it, so the UI never reports a failed transaction as success.
 */
export async function waitConfirmed(client: PublicClient, hash: Hash, label: string) {
  const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 2 });
  if (receipt.status !== 'success') {
    throw new Error(`${label} was reverted on-chain. See ${basescanTx(hash)}`);
  }
  return receipt;
}
