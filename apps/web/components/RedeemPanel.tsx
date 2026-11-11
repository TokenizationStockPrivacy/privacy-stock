'use client';
import { useMemo, useState } from 'react';
import { useConnection, usePublicClient, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { getAddress, isAddress, type Address, type Hex } from 'viem';
import { CONTRACTS, SPLIT_POOL_VAULT } from '../lib/contracts';
import { friendlyError } from '../lib/errors';
import { formatExact, shortAddress } from '../lib/format';
import { CODE_PATTERN, commitmentFor } from '../lib/note';
import { useProtocolData } from '../lib/useProtocolData';
import { IDLE, waitConfirmed, type TxState } from '../lib/tx';
import { TxStatus } from './TxStatus';

type NoteInfo = { amount: bigint; recipient: Address };

export function RedeemPanel() {
  const { address, chainId, isConnected } = useConnection();
  const publicClient = usePublicClient({ chainId: base.id });
  const { mutateAsync: writeAsync } = useWriteContract();
  const data = useProtocolData(address);

  const [code, setCode] = useState('');
  const [recipientInput, setRecipientInput] = useState('');
  const [note, setNote] = useState<NoteInfo>();
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<TxState>(IDLE);

  const onBase = chainId === base.id;
  const codeError = code === '' || CODE_PATTERN.test(code) ? '' : 'The code is 66 characters: 0x followed by 64 hex characters.';
  const recipientError = recipientInput === '' || isAddress(recipientInput) ? '' : 'Enter a valid Base address.';
  const inputsReady = !codeError && !recipientError && code !== '' && recipientInput !== '';

  /** Parsed, checksummed recipient, used for both the lookup and the redemption. */
  const recipient = useMemo(() => (isAddress(recipientInput) ? getAddress(recipientInput) : undefined), [recipientInput]);

  function reset() {
    setNote(undefined);
  }

  /** Read-only check: finds the note for this code and recipient, so the user sees what will be sent before paying gas. */
  async function checkNote() {
    setTx(IDLE);
    setNote(undefined);
    if (!publicClient || !recipient || !CODE_PATTERN.test(code)) return;
    setChecking(true);
    try {
      const commitment = commitmentFor(code as Hex, recipient);
      // notes(commitment) returns the Note struct in order: depositor, recipient, amount, reclaimAfter.
      const [, noteRecipient, amount] = (await publicClient.readContract({
        address: SPLIT_POOL_VAULT, abi: CONTRACTS.SplitPoolVault.abi, functionName: 'notes', args: [commitment],
      })) as readonly [Address, Address, bigint, bigint];
      if (amount === BigInt(0)) {
        setTx({ phase: 'error', message: 'No active note matches this code and recipient. It may already be redeemed or reclaimed.' });
        return;
      }
      setNote({ amount, recipient: noteRecipient });
    } catch (e) {
      setTx({ phase: 'error', message: friendlyError(e) });
    } finally {
      setChecking(false);
    }
  }

  async function redeem() {
    if (!publicClient || !recipient || !address || !note) return;
    setBusy(true);
    setTx({ phase: 'signing', label: 'Redeem' });
    try {
      const hash = await writeAsync({
        address: SPLIT_POOL_VAULT,
        abi: CONTRACTS.SplitPoolVault.abi,
        functionName: 'redeem',
        args: [code as Hex, recipient],
        chainId: base.id,
      });
      setTx({ phase: 'pending', label: 'Redeem', hash });
      await waitConfirmed(publicClient, hash, 'Redemption');
      setTx({ phase: 'success', label: 'Redemption', hash, message: `${formatExact(note.amount)} AAPLc was sent to ${shortAddress(recipient)}.` });
      setCode('');
      setNote(undefined);
      await data.refetch();
    } catch (e) {
      setTx({ phase: 'error', message: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="redeem" aria-labelledby="redeem-title" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-16 sm:px-6">
      <div className="card">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div aria-hidden="true" className="flex size-24 items-center justify-center rounded-3xl border border-line bg-surface-2">
              <svg width="40" height="40" viewBox="0 0 200 230" className="apple-float"><path d="M100 62 C84 46 46 44 26 70 C6 96 8 140 22 170 C36 202 62 222 84 214 C92 211 108 211 116 214 C138 222 164 202 178 170 C192 140 194 96 174 70 C154 44 116 46 100 62 Z" className="apple-base" /></svg>
            </div>
            <p className="eyebrow mt-6">Redeem</p>
            <h2 id="redeem-title" className="mt-3 text-2xl font-semibold tracking-tight">Withdraw with a code</h2>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn-bg px-3 py-1 text-xs font-semibold text-ink">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-warn" />
              Single use. Public once redeemed.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="redeem-code" className="label">One-time code</label>
              <input
                id="redeem-code"
                className="field font-mono text-sm"
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
                value={code}
                aria-invalid={!!codeError}
                aria-describedby="redeem-code-help"
                onChange={(e) => { setCode(e.target.value.trim()); reset(); }}
              />
              <p id="redeem-code-help" className={`mt-1.5 min-h-5 text-xs ${codeError ? 'text-danger' : 'text-muted'}`}>{codeError || ' '}</p>
            </div>

            <div>
              <label htmlFor="redeem-recipient" className="label">Original recipient address</label>
              <input
                id="redeem-recipient"
                className="field font-mono text-sm"
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
                value={recipientInput}
                aria-invalid={!!recipientError}
                aria-describedby="redeem-recipient-help"
                onChange={(e) => { setRecipientInput(e.target.value.trim()); reset(); }}
              />
              <p id="redeem-recipient-help" className={`mt-1.5 min-h-5 text-xs ${recipientError ? 'text-danger' : 'text-muted'}`}>{recipientError || ' '}</p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className="btn btn-secondary" disabled={!inputsReady || checking || !publicClient} onClick={checkNote}>
                {checking ? 'Checking…' : 'Check note'}
              </button>
              {!isConnected ? (
                <p className="self-center text-sm text-muted">Connect a wallet to redeem.</p>
              ) : !onBase ? (
                <p className="self-center text-sm text-warn">Switch to Base mainnet to redeem.</p>
              ) : (
                <button type="button" className="btn btn-primary" disabled={!note || busy} onClick={redeem}>
                  {busy ? 'Redeeming…' : 'Withdraw to recipient'}
                </button>
              )}
            </div>

            {note && (
              <div role="status" className="rounded-xl border border-ok/40 bg-ok-bg p-4 text-sm">
                <p className="font-semibold">Note found</p>
                <p className="mt-1 text-muted">
                  {formatExact(note.amount)} AAPLc will be sent to <span className="font-mono text-ink">{shortAddress(note.recipient)}</span>.
                </p>
              </div>
            )}

            <TxStatus state={tx} />
            {address && <p className="text-xs text-muted">Submitting from <span className="font-mono">{shortAddress(address)}</span>. Funds go only to the recipient address above.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
