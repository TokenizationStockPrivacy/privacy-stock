'use client';
import { useConnection } from 'wagmi';
import { AAPLC_TOKEN, SPLIT_POOL_VAULT, basescanAddress } from '../lib/contracts';
import { formatNumber, toNumber } from '../lib/format';
import { useProtocolData } from '../lib/useProtocolData';
import { CountUp } from './CountUp';

/** Live headline numbers. Every figure is read from Base; the numbers count up when they change. */
export function StatsBar() {
  const { address } = useConnection();
  const data = useProtocolData(address);
  const dec = data.decimals;

  const stats = [
    { label: 'Your pool balance', value: address ? toNumber(data.poolBalance, dec) : undefined, empty: address ? '–' : 'Connect', unit: address ? data.symbol : '' },
    { label: 'Fees collected', value: toNumber(data.feesCollected, dec), empty: '–', unit: data.symbol },
    { label: 'Eligible Earn', value: toNumber(data.eligiblePrincipal, dec), empty: '–', unit: data.symbol },
    { label: 'In escrow', value: toNumber(data.escrowLocked, dec), empty: '–', unit: data.symbol },
  ];

  return (
    <section aria-labelledby="stats-title" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="stats-title" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <span className="live-dot" aria-hidden="true" />
          Live on Base
        </h2>
        <p className="chip">
          {data.symbol} · {dec} decimals · <a className="link" href={basescanAddress(AAPLC_TOKEN)} target="_blank" rel="noreferrer">token ↗</a>
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{s.label}</p>
            <p className="mt-3 break-words text-2xl font-semibold tabular-nums tracking-tight">
              {s.value === undefined ? s.empty : <CountUp value={s.value} format={formatNumber} />}
              {s.unit && s.value !== undefined && <span className="ml-1.5 text-sm font-medium text-muted">{s.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted">
        Split pool: <a className="link font-mono" href={basescanAddress(SPLIT_POOL_VAULT)} target="_blank" rel="noreferrer">{SPLIT_POOL_VAULT.slice(0, 10)}…</a>
      </p>
    </section>
  );
}
