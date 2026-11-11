import { FEE_SCHEDULE } from './feeSchedule';

/**
 * Five steps, shown as numbered columns with a small animated visual each.
 * The copy is one line per step. The full fee schedule sits in the Transfer panel.
 */
const STEPS = [
  { n: '01', title: 'Connect wallet', line: 'Use a Base wallet. Nothing is signed until you confirm.' },
  { n: '02', title: 'Fund the pool', line: 'Deposit once, then split the balance immediately.' },
  { n: '03', title: 'Create up to 100', line: 'Give every recipient a separate one-time code.' },
  { n: '04', title: 'Redeem', line: 'Funds go only to the recipient fixed for that note.' },
  { n: '05', title: 'Earn immediately', line: 'No activation delay. Rewards vary.' },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="border-y border-line">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 id="how-title" className="display-xl text-4xl sm:text-5xl">How it works</h2>
          <p className="max-w-xs text-sm text-muted">
            Fees: {FEE_SCHEDULE.tiers[0].rate} up to $1,000.{' '}
            <a className="link" href="#transfer">Full schedule</a>
          </p>
        </div>

        <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.n} className="step-card" style={{ animationDelay: `${i * 80}ms` }}>
              <span className="step-number">{s.n}</span>
              <h3 className="mt-4 text-xl font-medium">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.line}</p>
              <div className="step-visual" aria-hidden="true">
                <StepVisual n={i + 1} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StepVisual({ n }: { n: number }) {
  if (n === 1) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-xs">
        <span className="text-muted">Network</span>
        <span className="chip chip-ok"><span className="live-dot" />Base</span>
      </div>
    );
  }
  if (n === 2) {
    return (
      <div className="rounded-xl border border-line bg-surface-2 p-3 text-xs">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-muted">Example</p>
        <div className="flex justify-between"><span className="text-muted">Send</span><span className="font-mono">25.00 AAPLc</span></div>
        <div className="mt-2 flex justify-between"><span className="text-muted">To</span><span className="font-mono">0x3f…9a1c</span></div>
      </div>
    );
  }
  if (n === 3) {
    return (
      <div className="rounded-xl border border-line bg-surface-2 p-3">
        <p className="text-[11px] uppercase tracking-wider text-muted">One-time code</p>
        <p className="mt-1 font-mono text-xs">0x9c4e…b27a</p>
      </div>
    );
  }
  if (n === 4) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="chip font-mono">0x9c…b27a</span>
        <span className="text-muted">→</span>
        <span className="chip chip-ok">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
          Recipient
        </span>
      </div>
    );
  }
  return (
    <div className="fee-pool h-24">
      <span className="coin" style={{ left: '14%' }} />
      <span className="coin" style={{ left: '40%' }} />
      <span className="coin" style={{ left: '66%' }} />
      <span className="coin" style={{ left: '86%' }} />
      <span className="pool-level" />
    </div>
  );
}
