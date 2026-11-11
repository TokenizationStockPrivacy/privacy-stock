import { basescanTx } from '../lib/contracts';
import type { TxState } from '../lib/tx';

/** Inline transaction feedback. Announced to screen readers through the live region. */
export function TxStatus({ state }: { state: TxState }) {
  if (state.phase === 'idle') return null;

  const tone =
    state.phase === 'error' ? 'border-danger/40 bg-danger-bg text-danger'
    : state.phase === 'success' ? 'border-ok/40 bg-ok-bg text-ok'
    : 'border-brand/40 bg-brand-bg text-ink';

  const headline =
    state.phase === 'signing' ? `${state.label ?? 'Transaction'}: confirm in your wallet`
    : state.phase === 'pending' ? `${state.label ?? 'Transaction'}: waiting for Base confirmation`
    : state.phase === 'success' ? `${state.label ?? 'Transaction'} confirmed`
    : 'Something needs your attention';

  return (
    <div role={state.phase === 'error' ? 'alert' : 'status'} aria-live="polite" className={`mt-5 rounded-xl border p-4 text-sm ${tone}`}>
      <div className="flex items-start gap-3">
        {state.phase !== 'error' && state.phase !== 'success' && <span className="spinner" aria-hidden="true" />}
        <div className="min-w-0">
          <p className="font-semibold">{headline}</p>
          {state.message && <p className="mt-1 break-words text-muted">{state.message}</p>}
          {state.hash && (
            <a className="link mt-2 inline-block break-all text-xs" href={basescanTx(state.hash)} target="_blank" rel="noreferrer">
              View transaction on BaseScan ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
