/** Icon tiles. Each carries one short disclosure so the required risks stay visible without long paragraphs. */
const TILES = [
  { title: 'Public on-chain', line: 'Sender, recipient, amount, and fee are visible.', tone: 'ok', icon: 'eye' },
  { title: 'Code goes public', line: 'It appears in transaction data when used.', tone: 'warn', icon: 'unlock' },
  { title: 'Single use', line: 'A redeemed note cannot be used again.', tone: 'ok', icon: 'check' },
  { title: 'Fixed recipient', line: 'Funds only reach the address set for that note.', tone: 'ok', icon: 'lock' },
  { title: '90-day reclaim', line: 'Depositors can reclaim unredeemed deposits.', tone: 'ok', icon: 'clock' },
  { title: 'No fee refund', line: 'Fees are kept if a deposit is reclaimed.', tone: 'warn', icon: 'coin' },
  { title: 'Immediate Earn', line: 'No delay means fee sniping is possible.', tone: 'warn', icon: 'shield' },
  { title: 'Unaudited', line: 'Verified source is not a security audit.', tone: 'danger', icon: 'alert' },
] as const;

export function Security() {
  return (
    <section id="security" aria-labelledby="security-title" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
      <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="eyebrow">Security and transparency</p>
          <h2 id="security-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Know the limits</h2>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-danger/40 bg-danger-bg px-3 py-1 text-xs font-semibold text-ink">
            Not private. Not audited.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {TILES.map((t) => (
            <li key={t.title} className="tile">
              <span className={`tile-icon ${t.tone === 'ok' ? 'tile-ok' : t.tone === 'warn' ? 'tile-warn' : 'tile-danger'}`} aria-hidden="true">
                <TileIcon name={t.icon} />
              </span>
              <p className="font-semibold">{t.title}</p>
              <p className="text-sm text-muted">{t.line}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TileIcon({ name }: { name: (typeof TILES)[number]['icon'] }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'eye':
      return <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
    case 'unlock':
      return <svg {...common}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></svg>;
    case 'check':
      return <svg {...common}><path d="M5 12l5 5 9-10" /></svg>;
    case 'lock':
      return <svg {...common}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'coin':
      return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M9 12h6M12 9v6" /></svg>;
    case 'shield':
      return <svg {...common}><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" /></svg>;
    case 'alert':
      return <svg {...common}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v4M12 17.5v.5" /></svg>;
  }
}
