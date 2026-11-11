import { CONTRACTS, basescanAddress, sourcifyRepo } from '../lib/contracts';
import { VERIFICATION_RECORD, type VerifiedName } from '../lib/verification';

/**
 * Set NEXT_PUBLIC_REPO_URL at build time to show the GitHub button.
 * It is hidden when unset, so the page never links to a repository that does not exist.
 */
const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL;

const NAMES: VerifiedName[] = ['AppleFeeVault', 'RewardsVault', 'FeeManager'];

export function OpenSource() {
  return (
    <section id="open-source" aria-labelledby="open-source-title" className="border-y border-line bg-surface scroll-mt-24">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <p className="eyebrow">Open source</p>
            <h2 id="open-source-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              100% Open Source. Built on Base. Verifiable On-Chain.
            </h2>
            <p className="mt-5 leading-relaxed text-muted">
              Privacy Stock is an open-source AAPLc code-based escrow and fee-sharing application built on Base. Our smart contracts and verification materials are publicly available for anyone to inspect, reproduce, and review. We believe transparency and verifiable code are essential for building trust in decentralized applications.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <span className="chip chip-ok">MIT License</span>
              <a className="btn btn-secondary" href="/LICENSE.txt" target="_blank" rel="noreferrer">Read the license</a>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              {REPO_URL && (
                <a className="btn btn-primary" href={REPO_URL} target="_blank" rel="noreferrer">GitHub repository ↗</a>
              )}
              <a className="btn btn-secondary" href="#contracts">View smart contracts</a>
              <a className="btn btn-secondary" href="/privacy-stock-source.zip" download>Download complete source ↓</a>
            </div>
          </div>

          <div id="contracts" className="scroll-mt-24 rounded-2xl border border-line bg-bg p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">Deployed contracts on Base</p>
              <span className="chip">Checked {VERIFICATION_RECORD.checkedAt}</span>
            </div>
            <ul className="mt-5 divide-y divide-line">
              {NAMES.map((name) => {
                const c = CONTRACTS[name];
                const v = VERIFICATION_RECORD.contracts[name];
                const exact = v.match === 'exact_match' && v.creationMatch === 'exact_match' && v.runtimeMatch === 'exact_match';
                return (
                  <li key={name} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{name}</p>
                      <span className={exact ? 'chip chip-ok' : 'chip chip-warn'}>
                        {exact ? 'Sourcify exact match' : 'Verification pending'}
                      </span>
                    </div>
                    <p className="mt-1 break-all font-mono text-xs text-muted">{c.address}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs">
                      <a className="link" href={basescanAddress(c.address)} target="_blank" rel="noreferrer">BaseScan ↗</a>
                      <a className="link" href={sourcifyRepo(c.address)} target="_blank" rel="noreferrer">Sourcify source ↗</a>
                      <a className="link" href={`https://basescan.org/tx/${c.deployTx}`} target="_blank" rel="noreferrer">Deployment tx ↗</a>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-5 text-xs text-muted">
              Verified source matches the deployed bytecode. It is <span className="font-medium text-ink">not a security audit</span>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
