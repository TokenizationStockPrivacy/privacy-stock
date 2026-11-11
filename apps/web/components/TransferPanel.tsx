'use client';
import { useMemo, useState } from 'react';
import { useConnection, usePublicClient, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { getAddress, isAddress, type Address, type Hex } from 'viem';
import { AAPLC_TOKEN, CONTRACTS, FEE_MANAGER, SPLIT_POOL_VAULT, basescanAddress, erc20Abi } from '../lib/contracts';
import { friendlyError } from '../lib/errors';
import { formatExact, parseAmount } from '../lib/format';
import { commitmentFor, generateCode } from '../lib/note';
import { useProtocolData } from '../lib/useProtocolData';
import { IDLE, waitConfirmed, type TxState } from '../lib/tx';
import { TxStatus } from './TxStatus';
import { AmountField } from './AmountField';
import { FEE_SCHEDULE } from './feeSchedule';

type PreparedNote = { gross: bigint; fee: bigint; net: bigint; recipient: Address; code: Hex; commitment: Hex };

export function TransferPanel() {
  const { address, chainId, isConnected } = useConnection();
  const publicClient = usePublicClient({ chainId: base.id });
  const { mutateAsync: writeAsync } = useWriteContract();
  const data = useProtocolData(address);
  const [depositInput, setDepositInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [prepared, setPrepared] = useState<PreparedNote[]>([]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState<'deposit' | 'withdraw' | 'prepare' | 'create' | ''>('');
  const [tx, setTx] = useState<TxState>(IDLE);
  const decimals = data.decimals;
  const onBase = chainId === base.id;
  const poolBalance = data.poolBalance ?? BigInt(0);
  const writeReady = isConnected && onBase && !busy;
  const depositError = useMemo(() => validateAmount(depositInput, decimals, data.balance), [depositInput, decimals, data.balance]);
  const withdrawError = useMemo(() => validateAmount(withdrawInput, decimals, poolBalance), [withdrawInput, decimals, poolBalance]);
  const totalGross = prepared.reduce((sum, note) => sum + note.gross, BigInt(0));
  const totalFees = prepared.reduce((sum, note) => sum + note.fee, BigInt(0));
  const totalNet = prepared.reduce((sum, note) => sum + note.net, BigInt(0));

  function clearPrepared() { setPrepared([]); setSaved(false); setCreated(false); setCopied(false); }

  async function depositToPool() {
    if (!address || !publicClient) return;
    setBusy('deposit'); setTx(IDLE);
    try {
      const amount = parseAmount(depositInput, decimals);
      const allowance = (await publicClient.readContract({ address: AAPLC_TOKEN, abi: erc20Abi, functionName: 'allowance', args: [address, SPLIT_POOL_VAULT] })) as bigint;
      if (allowance < amount) {
        setTx({ phase: 'signing', label: 'Approve AAPLc for pool' });
        const approveHash = await writeAsync({ address: AAPLC_TOKEN, abi: erc20Abi, functionName: 'approve', args: [SPLIT_POOL_VAULT, amount], chainId: base.id });
        setTx({ phase: 'pending', label: 'Approve AAPLc for pool', hash: approveHash });
        await waitConfirmed(publicClient, approveHash, 'AAPLc pool approval');
      }
      setTx({ phase: 'signing', label: 'Pool deposit' });
      const hash = await writeAsync({ address: SPLIT_POOL_VAULT, abi: CONTRACTS.SplitPoolVault.abi, functionName: 'depositToPool', args: [amount], chainId: base.id });
      setTx({ phase: 'pending', label: 'Pool deposit', hash });
      await waitConfirmed(publicClient, hash, 'Pool deposit');
      setTx({ phase: 'success', label: 'Pool deposit', hash, message: 'Pool balance funded. You can split it immediately.' });
      setDepositInput(''); await data.refetch();
    } catch (e) { setTx({ phase: 'error', message: friendlyError(e) }); }
    finally { setBusy(''); }
  }

  async function withdrawFromPool() {
    if (!publicClient) return;
    setBusy('withdraw'); setTx(IDLE);
    try {
      const amount = parseAmount(withdrawInput, decimals);
      const hash = await writeAsync({ address: SPLIT_POOL_VAULT, abi: CONTRACTS.SplitPoolVault.abi, functionName: 'withdrawFromPool', args: [amount], chainId: base.id });
      setTx({ phase: 'pending', label: 'Pool withdrawal', hash });
      await waitConfirmed(publicClient, hash, 'Pool withdrawal');
      setTx({ phase: 'success', label: 'Pool withdrawal', hash });
      setWithdrawInput(''); clearPrepared(); await data.refetch();
    } catch (e) { setTx({ phase: 'error', message: friendlyError(e) }); }
    finally { setBusy(''); }
  }

  async function prepareBatch() {
    if (!publicClient) return;
    setBusy('prepare'); setTx(IDLE); clearPrepared();
    try {
      const rows = batchInput.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (rows.length === 0) throw new Error('Enter at least one recipient and amount.');
      if (rows.length > 100) throw new Error('One batch can contain at most 100 withdrawals. Use another batch for more.');
      const parsed = rows.map((row, index) => {
        const comma = row.lastIndexOf(',');
        if (comma < 0) throw new Error(`Line ${index + 1}: use recipient, amount`);
        const recipientText = row.slice(0, comma).trim();
        const amountText = row.slice(comma + 1).trim();
        if (!isAddress(recipientText)) throw new Error(`Line ${index + 1}: invalid Base address.`);
        return { recipient: getAddress(recipientText), gross: parseAmount(amountText, decimals) };
      });
      const gross = parsed.reduce((sum, row) => sum + row.gross, BigInt(0));
      if (gross > poolBalance) throw new Error(`This batch uses ${formatExact(gross)} AAPLc but your pool balance is ${formatExact(poolBalance)} AAPLc.`);
      const quotes = await publicClient.multicall({
        allowFailure: false,
        contracts: parsed.map((row) => ({ address: FEE_MANAGER, abi: CONTRACTS.FeeManager.abi, functionName: 'quote', args: [row.gross] })),
      }) as unknown as readonly (readonly [bigint, bigint, bigint, bigint, bigint, bigint])[];
      const next = parsed.map((row, index) => {
        const fee = quotes[index][0];
        if (fee >= row.gross) throw new Error(`Line ${index + 1}: the fee equals or exceeds the amount.`);
        const code = generateCode();
        return { ...row, fee, net: row.gross - fee, code, commitment: commitmentFor(code, row.recipient) };
      });
      setPrepared(next);
    } catch (e) { setTx({ phase: 'error', message: friendlyError(e) }); }
    finally { setBusy(''); }
  }

  async function createNotes() {
    if (!publicClient || prepared.length === 0) return;
    setBusy('create'); setTx({ phase: 'signing', label: 'Create withdrawal notes' });
    try {
      const hash = await writeAsync({
        address: SPLIT_POOL_VAULT,
        abi: CONTRACTS.SplitPoolVault.abi,
        functionName: 'createNotes',
        args: [prepared.map((n) => n.gross), prepared.map((n) => n.recipient), prepared.map((n) => n.commitment), prepared.map((n) => n.fee)],
        chainId: base.id,
      });
      setTx({ phase: 'pending', label: 'Create withdrawal notes', hash });
      await waitConfirmed(publicClient, hash, 'Note batch');
      setCreated(true);
      setTx({ phase: 'success', label: 'Withdrawal notes created', hash, message: `${prepared.length} independent note${prepared.length === 1 ? '' : 's'} created. Keep every code until its recipient redeems.` });
      await data.refetch();
    } catch (e) { setTx({ phase: 'error', message: friendlyError(e) }); }
    finally { setBusy(''); }
  }

  const exportText = prepared.map((n, i) => [`Note ${i + 1}`, `Recipient: ${n.recipient}`, `Gross: ${formatExact(n.gross)} AAPLc`, `Fee: ${formatExact(n.fee)} AAPLc`, `Recipient receives: ${formatExact(n.net)} AAPLc`, `Code: ${n.code}`, ''].join('\n')).join('\n');
  async function copyAll() { try { await navigator.clipboard.writeText(exportText); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setTx({ phase: 'error', message: 'Copy failed. Download the code file instead.' }); } }
  function downloadAll() {
    const blob = new Blob([`Privacy Stock V2 withdrawal notes\nNetwork: Base mainnet (8453)\nPool: ${SPLIT_POOL_VAULT}\n\n${exportText}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `privacy-stock-${prepared.length}-notes.txt`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section id="transfer" aria-labelledby="transfer-title" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
      <div className="max-w-3xl"><p className="eyebrow">Split pool V2</p><h2 id="transfer-title" className="display-xl mt-4 text-4xl sm:text-5xl">Deposit once. Split up to 100 ways.</h2><p className="mt-4 text-muted">Create independent recipient-and-code withdrawals immediately. Example: 1 AAPLc → 100 gross withdrawals of 0.01 AAPLc.</p></div>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="font-semibold">1. Fund your reusable pool balance</h3>
          <p className="mt-2 text-sm text-muted">Wallet balance: {isConnected ? `${formatExact(data.balance ?? BigInt(0))} ${data.symbol}` : 'Connect wallet'} · Pool balance: {isConnected ? `${formatExact(poolBalance)} ${data.symbol}` : '–'}</p>
          <div className="mt-5"><AmountField id="pool-deposit" label="Deposit amount (AAPLc)" value={depositInput} onChange={setDepositInput} available={data.balance} availableLabel="Wallet balance" decimals={decimals} symbol={data.symbol} connected={isConnected} error={depositError} /></div>
          <button type="button" className="btn btn-primary mt-2 w-full" disabled={!writeReady || !depositInput || !!depositError} onClick={depositToPool}>{busy === 'deposit' ? 'Working…' : 'Approve and deposit to pool'}</button>
          <div className="mt-7 border-t border-line pt-5"><AmountField id="pool-withdraw" label="Withdraw unused pool balance" value={withdrawInput} onChange={setWithdrawInput} available={isConnected ? poolBalance : undefined} availableLabel="Pool balance" decimals={decimals} symbol={data.symbol} connected={isConnected} error={withdrawError} /><button type="button" className="btn btn-secondary mt-2 w-full" disabled={!writeReady || !withdrawInput || !!withdrawError || poolBalance === BigInt(0)} onClick={withdrawFromPool}>{busy === 'withdraw' ? 'Withdrawing…' : 'Withdraw from pool'}</button></div>
        </div>
        <div className="card">
          <h3 className="font-semibold">2. Enter 1–100 withdrawals</h3>
          <p className="mt-2 text-sm text-muted">One line per withdrawal: <code className="font-mono">recipient address, amount</code></p>
          <textarea className="field mt-4 min-h-52 font-mono text-xs" aria-label="Batch recipients and amounts" placeholder={'0xRecipientA, 0.01\n0xRecipientB, 0.01'} value={batchInput} onChange={(e) => { setBatchInput(e.target.value); clearPrepared(); }} />
          <button type="button" className="btn btn-primary mt-4 w-full" disabled={!isConnected || !onBase || !batchInput.trim() || !!busy || poolBalance === BigInt(0)} onClick={prepareBatch}>{busy === 'prepare' ? 'Quoting fees…' : 'Generate codes and quote batch'}</button>
          <details className="mt-5 text-xs text-muted"><summary className="cursor-pointer font-medium text-ink">Fee schedule</summary><p className="mt-2 leading-relaxed">{FEE_SCHEDULE.summary}</p></details>
        </div>
      </div>

      {prepared.length > 0 && <div className="card mt-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-semibold">3. Save every code, then create the batch</h3><p className="mt-1 text-sm text-muted">{prepared.length} notes · Gross {formatExact(totalGross)} · Fees {formatExact(totalFees)} · Recipients receive {formatExact(totalNet)} AAPLc</p></div><span className="chip chip-warn">Codes cannot be recovered</span></div>
        <pre className="mt-5 max-h-96 overflow-auto rounded-lg border border-line bg-bg p-4 text-xs">{exportText}</pre>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="btn btn-secondary" onClick={copyAll}>{copied ? 'Copied' : 'Copy all codes'}</button><button type="button" className="btn btn-secondary" onClick={downloadAll}>Download all codes (.txt)</button></div>
        <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 accent-brand" checked={saved} onChange={(e) => setSaved(e.target.checked)} /><span>I saved every code and recipient address.</span></label>
        <button type="button" className="btn btn-primary btn-lg mt-4 w-full" disabled={!writeReady || !saved || created} onClick={createNotes}>{busy === 'create' ? 'Creating batch…' : created ? 'Batch confirmed' : `Create ${prepared.length} withdrawal note${prepared.length === 1 ? '' : 's'}`}</button>
      </div>}
      {!isConnected && <p className="mt-6 text-sm text-muted">Connect a wallet to use the pool.</p>}{isConnected && !onBase && <p className="mt-6 text-sm text-warn">Switch your wallet to Base mainnet.</p>}
      <TxStatus state={tx} />
      <p className="mt-6 text-xs text-muted">Each entered amount is gross; its protocol fee is deducted from that amount. Activity is public and contracts are unaudited. <a className="link" href={basescanAddress(SPLIT_POOL_VAULT)} target="_blank" rel="noreferrer">View pool on BaseScan ↗</a></p>
    </section>
  );
}

function validateAmount(input: string, decimals: number, max?: bigint): string {
  if (input === '') return '';
  try { const value = parseAmount(input, decimals); if (max !== undefined && value > max) return 'That is more than available.'; return ''; }
  catch (e) { return e instanceof Error ? e.message : 'Enter a valid amount.'; }
}
