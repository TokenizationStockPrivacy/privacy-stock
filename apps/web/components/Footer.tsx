import { AAPLC_TOKEN, CONTRACTS, BASE_CHAIN_ID, SPLIT_POOL_VAULT, basescanAddress } from '../lib/contracts';

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <p className="font-semibold">Privacy Stock</p>
          <p className="mt-2 max-w-sm text-muted">
            Open-source AAPLc code escrow and fee-sharing on Base. Unaudited. Not a privacy pool and not an investment product.
          </p>
          <p className="mt-4 chip chip-warn">Base mainnet · chain {BASE_CHAIN_ID}</p>
        </div>

        <div>
          <p className="font-semibold">Contracts</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li><a className="link" href={basescanAddress(CONTRACTS.SplitPoolVault.address)} target="_blank" rel="noreferrer">SplitPoolVault V2</a></li>
            <li><a className="link" href={basescanAddress(CONTRACTS.RewardsVaultV2.address)} target="_blank" rel="noreferrer">RewardsVault V2</a></li>
            <li><a className="link" href={basescanAddress(CONTRACTS.FeeManager.address)} target="_blank" rel="noreferrer">FeeManager</a></li>
            <li><a className="link" href={basescanAddress(AAPLC_TOKEN)} target="_blank" rel="noreferrer">AAPLc token</a></li>
          </ul>
        </div>

        <div>
          <p className="font-semibold">Source and docs</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li><a className="link" href="/privacy-stock-source.zip" download>Complete source (.zip)</a></li>
            <li><a className="link" href="/LICENSE.txt" target="_blank" rel="noreferrer">MIT license</a></li>
            <li><a className="link" href="#open-source">Verification status</a></li>
            <li><a className="link" href="#security">Security and transparency</a></li>
            <li><a className="link" href="/legacy-v1">Legacy V1 recovery</a></li>
          </ul>
          <p className="mt-6 break-all font-mono text-xs text-muted">Pool: {SPLIT_POOL_VAULT}</p>
        </div>
      </div>
      <div className="border-t border-line px-4 py-4 text-center text-xs text-muted sm:px-6">
        Public on-chain activity. Do not treat this site as an audit, a guarantee, or financial advice.
      </div>
    </footer>
  );
}
