'use client';
import { useMemo, useState } from 'react';
import { useConnection, usePublicClient, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { getAddress, isAddress, type Address, type Hex } from 'viem';
import {
  APPLE_FEE_VAULT, AAPLC_TOKEN, CONTRACTS, FEE_MANAGER, erc20Abi, basescanAddress,
} from '../lib/contracts';
import { friendlyError } from '../lib/errors';
import { AAPLC_DECIMALS, formatAaplc, formatExact, parseAmount, shortAddress } from '../lib/format';
import { commitmentFor, generateCode } from '../lib/note';
import { useProtocolData } from '../lib/useProtocolData';
import { IDLE, waitConfirmed, type TxState } from '../lib/tx';
import { TxStatus } from './TxStatus';
import { AmountField } from './AmountField';
import { FEE_SCHEDULE } from './feeSchedule';

type Quote = {
  amount: bigint;
  fee: bigint;
  net: bigint;
  price: bigint;
  recipient: Address;
  code: Hex;
  commitment: Hex;
};

export function TransferPanel() {
  const { address, chainId, isConnected } = useConnection();
  const publicClient = usePublicClient({ chainId: base.id });
  const { mutateAsync: writeAsync } = useWriteContract();
  const data = useProtocolData(address);

  const [amountInput, setAmountInput] = useState('');
  const [recipientInput, setRecipientInput] = useState('');
  const [quote, setQuote] = useState<Quote>();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<TxState>(IDLE);
  const [deposited, setDeposited] = useState<{ hash: Hex; quote: Quote }>();

  const onBase = chainId === base.id;
  const decimals = data.decimals;

  const amountError = useMemo(() => {
    if (amountInput === '') return '';
    try {
      const v = parseAmount(amountInput, decimals);
      if (data.balance !== undefined && v > data.balance) return 'That is more than your AAPLc balance.';
      return '';
    } catch (e) {
      return e instanceof Error ? e.message : 'Enter a valid amount.';
    }
  }, [amountInput, data.balance, decimals]);

  const recipientError = recipientInput === '' || isAddress(recipientInput) ? '' : 'Enter a valid Base address (0x followed by 40 hex characters).';
  const noEligiblePosition = data.eligiblePrincipal === BigInt(0);
  const pendingPrincipal = data.position?.pending ?? BigInt(0);
  const pendingUnlockAt = data.position?.unlockAt ?? BigInt(0);
  const pendingIsReady = pendingPrincipal > BigInt(0) && pendingUnlockAt <= BigInt(Math.floor(Date.now() / 1000));
  const activationTime = pendingPrincipal > BigInt(0)
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(Number(pendingUnlockAt) * 1000))
    : '';

  function resetQuote() {
    setQuote(undefined);
    setSaved(false);
    setCopied(false);
  }

  /** Reads the live fee and builds a fresh one-time code. Nothing is sent on-chain here. */
  async function generateQuote() {
    setTx(IDLE);
    setDeposited(undefined);
    if (!publicClient) return setTx({ phase: 'error', message: 'Base RPC is unavailable. Try again shortly.' });
    setBusy(true);
    try {
      const amount = parseAmount(amountInput, decimals);
      if (!isAddress(recipientInput)) throw new Error('Enter a valid recipient address.');
      const recipient = getAddress(recipientInput);
      if (data.balance !== undefined && amount > data.balance) throw new Error('That is more than your AAPLc balance.');

      const [fee, , , , price] = (await publicClient.readContract({
        address: FEE_MANAGER, abi: CONTRACTS.FeeManager.abi, functionName: 'quote', args: [amount],
      })) as readonly [bigint, bigint, bigint, bigint, bigint, bigint];

      if (fee >= amount) throw new Error('The fee would equal or exceed this amount. Send a larger amount.');

      const code = generateCode();
      const commitment = commitmentFor(code, recipient);
      setQuote({ amount, fee, net: amount - fee, price, recipient, code, commitment });
      setSaved(false);
    } catch (e) {
      setTx({ phase: 'error', message: friendlyError(e) });
      resetQuote();
    } finally {
      setBusy(false);
    }
  }

  async function deposit() {
    if (!quote || !address || !publicClient) return;
    setBusy(true);
    setTx(IDLE);
    try {
      // Re-read the fee before signing. If it rose above the reviewed quote, the contract would reject it anyway.
      const [liveFee] = (await publicClient.readContract({
        address: FEE_MANAGER, abi: CONTRACTS.FeeManager.abi, functionName: 'quote', args: [quote.amount],
      })) as readonly [bigint, bigint, bigint, bigint, bigint, bigint];
      if (liveFee > quote.fee) {
        throw new Error('The fee moved above the quote you reviewed. Generate a new quote and review it again.');
      }

      const allowance = (await publicClient.readContract({
        address: AAPLC_TOKEN, abi: erc20Abi, functionName: 'allowance', args: [address, APPLE_FEE_VAULT],
      })) as bigint;

      if (allowance < quote.amount) {
        setTx({ phase: 'signing', label: 'Approve AAPLc' });
        const approveHash = await writeAsync({
          address: AAPLC_TOKEN, abi: erc20Abi, functionName: 'approve', args: [APPLE_FEE_VAULT, quote.amount], chainId: base.id,
        });
        setTx({ phase: 'pending', label: 'Approve AAPLc', hash: approveHash });
        await waitConfirmed(publicClient, approveHash, 'AAPLc approval');
      }

      setTx({ phase: 'signing', label: 'Deposit' });
      const hash = await writeAsync({
        address: APPLE_FEE_VAULT,
        abi: CONTRACTS.AppleFeeVault.abi,
        functionName: 'deposit',
        args: [quote.amount, quote.recipient, quote.commitment, quote.fee],
        chainId: base.id,
      });
      setTx({ phase: 'pending', label: 'Deposit', hash });
      await waitConfirmed(publicClient, hash, 'Deposit');

      setDeposited({ hash, quote });
      setTx({ phase: 'success', label: 'Deposit', hash, message: 'Share the code with the recipient. Keep a copy until they redeem.' });
      setAmountInput('');
      setQuote(undefined);
      setSaved(false);
      await data.refetch();
    } catch (e) {
      setTx({ phase: 'error', message: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  }

  async function copyCode(code: Hex) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setTx({ phase: 'error', message: 'Copy failed. Select the code and copy it manually.' });
    }
  }

  function downloadNote(q: Quote, hash?: Hex) {
    const lines = [
      'Privacy Stock one-time AAPLc note',
      'Keep this file private. Anyone with the code can submit the redemption.',
      'The AAPLc is sent only to the recipient address below.',
      '',
      `Amount deposited: ${formatExact(q.amount)} AAPLc`,
      `Recipient (fixed): ${q.recipient}`,
      `One-time code: ${q.code}`,
      `Escrow contract: ${APPLE_FEE_VAULT}`,
      `Network: Base mainnet (8453)`,
      hash ? `Deposit transaction: ${hash}` : '',
      `Created: ${new Date().toISOString()}`,
      '',
      'Not private: the code becomes public when it is used. The contract is unaudited.',
    ].filter((l) => l !== '');
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `privacy-stock-note-${q.commitment.slice(2, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const canQuote = amountInput !== '' && recipientInput !== '' && !amountError && !recipientError && !busy && !noEligiblePosition;
  const canDeposit = !!quote && saved && onBase && isConnected && !busy && !noEligiblePosition;

  return (
    <section id="transfer" aria-labelledby="transfer-title" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
      <div className="max-w-2xl">
        <p className="eyebrow">Send</p>
        <h2 id="transfer-title" className="display-xl mt-4 text-4xl sm:text-5xl">Send with a code</h2>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="card">
          <h3 className="font-semibold">1. Enter the transfer</h3>

          <div className="mt-5">
            <AmountField
              id="deposit-amount"
              label="Amount (AAPLc)"
              value={amountInput}
              onChange={(v) => { setAmountInput(v); resetQuote(); }}
              available={data.balance}
              availableLabel="You can send up to"
              decimals={decimals}
              symbol={data.symbol}
              connected={isConnected}
              error={amountError}
              hint={noEligiblePosition
                ? pendingPrincipal > BigInt(0)
                  ? 'Paused until your pending Earn deposit is activated.'
                  : 'Paused. Deposits resume once an Earn position is active.'
                : `Up to ${AAPLC_DECIMALS} decimal places. The fee is taken from this amount.`}
              disabled={noEligiblePosition}
              onMax={() => resetQuote()}
            />
          </div>

          <div className="mt-4">
            <label htmlFor="recipient" className="label">Recipient Base address</label>
            <input
              id="recipient"
              className="field font-mono text-sm"
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              value={recipientInput}
              aria-invalid={!!recipientError}
              aria-describedby="recipient-help"
              onChange={(e) => { setRecipientInput(e.target.value.trim()); resetQuote(); }}
            />
            <p id="recipient-help" className={`mt-1.5 min-h-5 text-xs ${recipientError ? 'text-danger' : 'text-muted'}`}>
              {recipientError || 'Double-check this address. It cannot be changed after the deposit.'}
            </p>
          </div>

          {noEligiblePosition && (
            <p role="status" className="mt-4 rounded-lg border border-warn/40 bg-warn-bg p-3 text-xs text-ink">
              {pendingPrincipal > BigInt(0) ? (
                <>
                  Your <strong>{formatExact(pendingPrincipal)} AAPLc</strong> Earn deposit is {pendingIsReady ? 'ready to activate' : `pending until ${activationTime}`}.
                  {' '}Go to <a className="link font-semibold" href="#earn">Earn</a> {pendingIsReady ? 'now' : 'after that time'} and click <strong>Activate eligible deposit</strong>. Transfers resume after the activation transaction confirms.
                </>
              ) : (
                <>No Earn position is eligible yet. Deposit in <a className="link font-semibold" href="#earn">Earn</a>, wait 24 hours, then activate it.</>
              )}
            </p>
          )}

          <div className="mt-6">
            {!isConnected ? (
              <p className="text-sm text-muted">Connect a wallet in the header to continue.</p>
            ) : !onBase ? (
              <p className="text-sm text-warn">Switch your wallet to Base mainnet to continue.</p>
            ) : (
              <button type="button" className="btn btn-primary btn-lg w-full sm:w-auto" disabled={!canQuote} onClick={generateQuote}>
                {busy && !quote ? 'Reading the live fee…' : 'Generate code and quote'}
              </button>
            )}
          </div>

          <details className="mt-6 text-xs text-muted">
            <summary className="cursor-pointer font-medium text-ink">Fee schedule</summary>
            <p className="mt-2 leading-relaxed">{FEE_SCHEDULE.summary}</p>
          </details>
        </div>

        <div className="card flex flex-col">
          <h3 className="font-semibold">2. Review, save the code, and deposit</h3>

          {!quote && !deposited && (
            <p className="mt-4 text-sm text-muted">
              Generate a quote to see the fee, the amount the recipient will receive, and the one-time code.
            </p>
          )}

          {quote && (
            <div className="mt-4 space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="summary-cell"><dt className="text-muted">You send</dt><dd className="font-semibold tabular-nums">{formatExact(quote.amount)} AAPLc</dd></div>
                <div className="summary-cell"><dt className="text-muted">Fee (on deposit)</dt><dd className="font-semibold tabular-nums">{formatExact(quote.fee)} AAPLc</dd></div>
                <div className="summary-cell"><dt className="text-muted">Recipient receives</dt><dd className="font-semibold tabular-nums">{formatExact(quote.net)} AAPLc</dd></div>
                <div className="summary-cell"><dt className="text-muted">Oracle price</dt><dd className="font-semibold tabular-nums">${(Number(quote.price) / 1e8).toFixed(2)}</dd></div>
              </dl>
              <p className="text-xs text-muted">
                Recipient: <span className="font-mono text-ink">{shortAddress(quote.recipient)}</span>. The fee shown is the maximum you authorize.
              </p>

              <div className="rounded-xl border border-warn/40 bg-warn-bg p-4">
                <p className="text-sm font-semibold text-ink">Your one-time code</p>
                <p className="mt-1 text-xs text-ink/80">
                  Save this code now. The website cannot recover it. Anyone with the code can redeem, and the code becomes public when used.
                </p>
                <code className="mt-3 block break-all rounded-lg border border-line bg-bg p-3 font-mono text-xs text-ink select-all">
                  {quote.code}
                </code>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => copyCode(quote.code)}>
                    {copied ? 'Copied' : 'Copy code'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => downloadNote(quote)}>
                    Download note (.txt)
                  </button>
                </div>
                <label className="mt-4 flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 size-4 accent-brand" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
                  <span>I saved the code and the recipient address.</span>
                </label>
              </div>

              <button type="button" className="btn btn-primary btn-lg w-full" disabled={!canDeposit} onClick={deposit}>
                {busy ? 'Working…' : 'Approve AAPLc and deposit'}
              </button>
              <button type="button" className="btn btn-ghost w-full" onClick={() => { resetQuote(); setTx(IDLE); }} disabled={busy}>
                Cancel and clear the code
              </button>
            </div>
          )}

          {deposited && !quote && (
            <div className="mt-4 space-y-4">
              <p className="text-sm">
                Deposit confirmed for <span className="font-semibold tabular-nums">{formatExact(deposited.quote.amount)} AAPLc</span> to{' '}
                <span className="font-mono">{shortAddress(deposited.quote.recipient)}</span>.
              </p>
              <p className="text-sm text-muted">
                Share the code with the recipient through a channel you trust. Sharing it outside that channel gives it to anyone who sees it.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => copyCode(deposited.quote.code)}>
                  {copied ? 'Copied' : 'Copy code again'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => downloadNote(deposited.quote, deposited.hash)}>
                  Download note (.txt)
                </button>
              </div>
              <a className="link text-sm" href={basescanAddress(APPLE_FEE_VAULT)} target="_blank" rel="noreferrer">View escrow contract on BaseScan ↗</a>
            </div>
          )}

          <TxStatus state={tx} />
          {deposited && !quote && (
            <p className="mt-6 text-xs text-muted">The code stays on this page until you reload. Reloading removes it from the browser, so save it first.</p>
          )}
        </div>
      </div>
    </section>
  );
}
