'use client';
import { useMemo, useState } from 'react';
import { useConnection, usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { CONTRACTS, LEGACY_REWARDS_VAULT, basescanAddress } from '../lib/contracts';
import { formatExact, parseAmount } from '../lib/format';
import { friendlyError } from '../lib/errors';
import { IDLE, waitConfirmed, type TxState } from '../lib/tx';
import { WalletButton } from './WalletButton';
import { AmountField } from './AmountField';
import { TxStatus } from './TxStatus';

export function LegacyV1Recovery() {
  const { address, chainId, isConnected } = useConnection();
  const publicClient = usePublicClient({ chainId: base.id });
  const { mutateAsync: writeAsync } = useWriteContract();
  const position = useReadContract({ address: LEGACY_REWARDS_VAULT, abi: CONTRACTS.RewardsVault.abi, functionName: 'positions', args: address ? [address] : undefined, chainId: base.id, query: { enabled: !!address } });
  const tuple = position.data as readonly [bigint, bigint, bigint, bigint, bigint] | undefined;
  const available = (tuple?.[0] ?? BigInt(0)) + (tuple?.[1] ?? BigInt(0));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<TxState>(IDLE);
  const error = useMemo(() => {
    if (!input) return '';
    try { if (parseAmount(input, 8) > available) return 'That is more than your V1 principal.'; return ''; }
    catch (e) { return e instanceof Error ? e.message : 'Enter a valid amount.'; }
  }, [input, available]);

  async function withdraw() {
    if (!publicClient) return;
    setBusy(true); setTx(IDLE);
    try {
      const hash = await writeAsync({ address: LEGACY_REWARDS_VAULT, abi: CONTRACTS.RewardsVault.abi, functionName: 'withdraw', args: [parseAmount(input, 8)], chainId: base.id });
      setTx({ phase: 'pending', label: 'Withdraw legacy V1 principal', hash });
      await waitConfirmed(publicClient, hash, 'Legacy V1 withdrawal');
      setTx({ phase: 'success', label: 'Legacy V1 withdrawal', hash });
      setInput(''); await position.refetch();
    } catch (e) { setTx({ phase: 'error', message: friendlyError(e) }); }
    finally { setBusy(false); }
  }

  return <main id="main" className="mx-auto min-h-screen max-w-3xl px-4 py-10 sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6"><div><a href="/" className="eyebrow">Privacy Stock V2</a><h1 className="mt-2 text-3xl font-semibold">Legacy V1 recovery</h1></div><WalletButton /></header>
    <section className="card mt-8"><h2 className="text-xl font-semibold">Withdraw old RewardsVault principal</h2><p className="mt-2 text-sm text-muted">This page cannot add new V1 deposits. It only recovers principal left in the immutable legacy vault.</p><p className="mt-4 text-sm">Available: <strong>{isConnected ? `${formatExact(available)} AAPLc` : 'Connect wallet'}</strong></p><div className="mt-5"><AmountField id="legacy-withdraw" label="Amount (AAPLc)" value={input} onChange={setInput} available={isConnected ? available : undefined} availableLabel="V1 principal" decimals={8} symbol="AAPLc" connected={isConnected} error={error} /></div><button type="button" className="btn btn-primary mt-3 w-full" disabled={!isConnected || chainId !== base.id || !input || !!error || busy || available === BigInt(0)} onClick={withdraw}>{busy ? 'Withdrawing…' : 'Withdraw V1 principal'}</button><TxStatus state={tx} /><a className="link mt-6 block text-xs" href={basescanAddress(LEGACY_REWARDS_VAULT)} target="_blank" rel="noreferrer">View legacy vault on BaseScan ↗</a></section>
  </main>;
}
