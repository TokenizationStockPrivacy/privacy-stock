'use client';
import { useMemo, useState } from 'react';
import { useConnection, usePublicClient, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { AAPLC_TOKEN, CONTRACTS, REWARDS_VAULT, erc20Abi } from '../lib/contracts';
import { friendlyError } from '../lib/errors';
import { formatNumber, parseAmount, toNumber } from '../lib/format';
import { CountUp } from './CountUp';
import { AmountField } from './AmountField';
import { useProtocolData } from '../lib/useProtocolData';
import { IDLE, waitConfirmed, type TxState } from '../lib/tx';
import { TxStatus } from './TxStatus';

export function EarnPanel() {
  const { address, chainId, isConnected } = useConnection();
  const publicClient = usePublicClient({ chainId: base.id });
  const { mutateAsync: writeAsync } = useWriteContract();
  const data = useProtocolData(address);
  const [depositInput, setDepositInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');
  const [busy, setBusy] = useState<'deposit' | 'withdraw' | 'claim' | ''>('');
  const [tx, setTx] = useState<TxState>(IDLE);
  const decimals = data.decimals;
  const onBase = chainId === base.id;
  const principal = data.position?.principal ?? BigInt(0);
  const reward = data.pendingReward ?? BigInt(0);
  const depositError = useMemo(() => validate(depositInput, decimals, data.balance), [depositInput, decimals, data.balance]);
  const withdrawError = useMemo(() => validate(withdrawInput, decimals, principal), [withdrawInput, decimals, principal]);
  const writeReady = isConnected && onBase && !busy;

  async function depositIntoEarn() {
    if (!address || !publicClient) return;
    setBusy('deposit'); setTx(IDLE);
    try {
      const amount = parseAmount(depositInput, decimals);
      const allowance = (await publicClient.readContract({ address: AAPLC_TOKEN, abi: erc20Abi, functionName: 'allowance', args: [address, REWARDS_VAULT] })) as bigint;
      if (allowance < amount) {
        setTx({ phase: 'signing', label: 'Approve AAPLc for Earn' });
        const approveHash = await writeAsync({ address: AAPLC_TOKEN, abi: erc20Abi, functionName: 'approve', args: [REWARDS_VAULT, amount], chainId: base.id });
        setTx({ phase: 'pending', label: 'Approve AAPLc for Earn', hash: approveHash });
        await waitConfirmed(publicClient, approveHash, 'AAPLc approval');
      }
      setTx({ phase: 'signing', label: 'Earn deposit' });
      const hash = await writeAsync({ address: REWARDS_VAULT, abi: CONTRACTS.RewardsVaultV2.abi, functionName: 'deposit', args: [amount], chainId: base.id });
      setTx({ phase: 'pending', label: 'Earn deposit', hash });
      await waitConfirmed(publicClient, hash, 'Earn deposit');
      setTx({ phase: 'success', label: 'Earn deposit', hash, message: 'Your principal is eligible immediately. There is no 24-hour wait.' });
      setDepositInput(''); await data.refetch();
    } catch (e) { setTx({ phase: 'error', message: friendlyError(e) }); }
    finally { setBusy(''); }
  }

  async function runWrite(kind: 'claim' | 'withdraw', label: string) {
    if (!publicClient) return;
    setBusy(kind); setTx(IDLE);
    try {
      const args = kind === 'withdraw' ? [parseAmount(withdrawInput, decimals)] : undefined;
      const hash = await writeAsync({ address: REWARDS_VAULT, abi: CONTRACTS.RewardsVaultV2.abi, functionName: kind, ...(args ? { args } : {}), chainId: base.id });
      setTx({ phase: 'pending', label, hash });
      await waitConfirmed(publicClient, hash, label);
      setTx({ phase: 'success', label, hash });
      if (kind === 'withdraw') setWithdrawInput('');
      await data.refetch();
    } catch (e) { setTx({ phase: 'error', message: friendlyError(e) }); }
    finally { setBusy(''); }
  }

  return (
    <section id="earn" aria-labelledby="earn-title" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
      <div className="grid items-center gap-8 md:grid-cols-[1fr_1fr]">
        <div><p className="eyebrow">Earn vault V2</p><h2 id="earn-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Share future pool fees immediately</h2><p className="mt-3 text-sm text-muted">No activation delay. Variable rewards; no yield is guaranteed.</p></div>
        <div className="fee-pool" role="img" aria-label="Animated fees flowing into the Earn pool"><span className="coin" style={{ left: '14%' }} /><span className="coin" style={{ left: '40%' }} /><span className="coin" style={{ left: '66%' }} /><span className="coin" style={{ left: '86%' }} /><span className="pool-level" /></div>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Stat label="Eligible principal" value={isConnected ? toNumber(principal, decimals) : undefined} unit={isConnected ? data.symbol : ''} />
        <Stat label="Claimable rewards" value={isConnected ? toNumber(reward, decimals) : undefined} unit={isConnected ? data.symbol : ''} />
        <div className="stat-card"><p className="text-xs font-medium uppercase tracking-wider text-muted">Activation</p><p className="mt-3 text-2xl font-semibold text-ok">Immediate</p></div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card"><p className="font-semibold">Deposit into Earn</p><p className="mt-1 text-xs text-muted">Principal starts sharing future fees as soon as the transaction confirms.</p><div className="mt-4"><AmountField id="earn-deposit" label="Amount (AAPLc)" value={depositInput} onChange={setDepositInput} available={data.balance} availableLabel="Wallet balance" decimals={decimals} symbol={data.symbol} connected={isConnected} error={depositError} /></div><button type="button" className="btn btn-primary mt-2 w-full" disabled={!writeReady || !depositInput || !!depositError} onClick={depositIntoEarn}>{busy === 'deposit' ? 'Working…' : 'Approve and deposit'}</button></div>
        <div className="card"><p className="font-semibold">Claim fees</p><p className="mt-1 text-xs text-muted">Claims your share of fees already allocated to Earn.</p><button type="button" className="btn btn-secondary mt-6 w-full" disabled={!writeReady || reward === BigInt(0)} onClick={() => runWrite('claim', 'Claim rewards')}>{busy === 'claim' ? 'Claiming…' : 'Claim rewards'}</button></div>
        <div className="card"><p className="font-semibold">Withdraw principal</p><p className="mt-1 text-xs text-muted">Withdraw any amount of your Earn principal immediately.</p><div className="mt-4"><AmountField id="earn-withdraw" label="Amount (AAPLc)" value={withdrawInput} onChange={setWithdrawInput} available={isConnected ? principal : undefined} availableLabel="You can withdraw up to" decimals={decimals} symbol={data.symbol} connected={isConnected} error={withdrawError} /></div><button type="button" className="btn btn-secondary mt-2 w-full" disabled={!writeReady || !withdrawInput || !!withdrawError || principal === BigInt(0)} onClick={() => runWrite('withdraw', 'Withdraw principal')}>{busy === 'withdraw' ? 'Withdrawing…' : 'Withdraw principal'}</button></div>
      </div>
      {!isConnected && <p className="mt-6 text-sm text-muted">Connect a wallet to see your Earn position.</p>}
      {isConnected && !onBase && <p className="mt-6 text-sm text-warn">Switch your wallet to Base mainnet to use Earn.</p>}
      <TxStatus state={tx} />
      <p className="mt-8 text-xs text-muted">Immediate eligibility can permit fee sniping. Rewards can be zero for long periods. Earn is unaudited.</p>
    </section>
  );
}

function Stat({ label, value, unit }: { label: string; value?: number; unit: string }) {
  return <div className="stat-card"><p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p><p className="mt-3 text-2xl font-semibold tabular-nums">{value === undefined ? '–' : <CountUp value={value} format={formatNumber} />}<span className="ml-1.5 text-sm font-medium text-muted">{unit}</span></p></div>;
}

function validate(input: string, decimals: number, max?: bigint): string {
  if (input === '') return '';
  try { const value = parseAmount(input, decimals); if (max !== undefined && value > max) return 'That is more than available.'; return ''; }
  catch (e) { return e instanceof Error ? e.message : 'Enter a valid amount.'; }
}
