import { formatAaplc, formatExact } from '../lib/format';

/**
 * Amount input that always shows the most the user can enter.
 * "Available" is the real limit for the action (wallet balance, or principal for withdrawals),
 * and Max fills it in exactly. Errors appear live, before the user submits anything.
 */
export function AmountField({
  id,
  label,
  value,
  onChange,
  available,
  availableLabel = 'Available',
  decimals,
  symbol,
  connected,
  error,
  hint,
  disabled = false,
  onMax,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Base units the user may enter. undefined while loading. */
  available: bigint | undefined;
  availableLabel?: string;
  decimals: number;
  symbol: string;
  connected: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  onMax?: () => void;
}) {
  const helpId = `${id}-help`;
  const availableText = !connected
    ? 'Connect a wallet to see how much you can enter'
    : available === undefined
      ? 'Loading…'
      : `${availableLabel}: ${formatAaplc(available, decimals, 8)} ${symbol}`;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="label">{label}</label>
        <p className="text-xs text-muted" aria-live="polite">
          <span className="font-medium tabular-nums text-ink">{availableText}</span>
        </p>
      </div>
      <div className="flex gap-2">
        <input
          id={id}
          className="field tabular-nums"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={helpId}
          onChange={(e) => onChange(e.target.value.replace(/,/g, '.').trim())}
        />
        <button
          type="button"
          className="btn btn-secondary shrink-0"
          disabled={disabled || available === undefined || available === BigInt(0)}
          onClick={() => {
            if (available !== undefined) onChange(formatExact(available, decimals));
            onMax?.();
            if (available === undefined) return;
          }}
        >
          Max
        </button>
      </div>
      <p id={helpId} className={`mt-1.5 min-h-5 text-xs ${error ? 'text-danger' : 'text-muted'}`}>
        {error || hint || ' '}
      </p>
    </div>
  );
}
