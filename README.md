# Privacy Stock

Open-source AAPLc code escrow and fee-sharing application on Base mainnet.

> **Unaudited. Not private.** Depositors, recipients, amounts, and fees are public on-chain. A one-time code becomes public when it is used. This is not a zero-knowledge privacy pool and not an investment product. No independent security audit has been completed.

## Split pool V2 (deployment prepared, not yet live)

V2 adds `SplitPoolVault` and `RewardsVaultV2`:

- Deposit AAPLc into one reusable pool balance.
- Split that balance into any number of independent fixed-recipient notes. For example, a 1 AAPLc balance can create two gross 0.5 AAPLc notes with different recipients and different codes.
- Each note deducts the quoted protocol fee from its gross amount.
- Note creation does not pause when Earn is empty. Fees remain backed in `SplitPoolVault` and are flushed when an Earn position exists.
- Earn principal is eligible immediately. This removes the V1 delay but introduces fee-sniping risk.

The local `/deploy-v2` page deploys both V2 contracts and assigns the split pool as fee collector. Do not treat V2 as live until its Base mainnet addresses are added to the deployment record and public website.

## What it does

1. **Transfer.** You deposit AAPLc for one fixed recipient. Your browser generates a one-time code. Anyone holding the code can submit the redemption, but the AAPLc only goes to the recipient fixed at deposit. Each deposit redeems once.
2. **Redeem.** The recipient (or anyone with the code) enters the code and the original recipient address. The site reads the note first, so you see the amount and recipient before you pay gas.
3. **Earn.** You deposit AAPLc into the Earn vault. After a 24-hour activation period, your eligible principal shares future deposit fees, in proportion to eligible principal. Rewards depend on real fee activity and other eligible positions. No yield is promised.

## Live deployment (Base mainnet, chain 8453)

| Contract | Address | Sourcify status (checked 2026-11-10) |
| --- | --- | --- |
| AppleFeeVault (escrow) | [0x8178B76de28E880bb1435346A4c227c0B92Bbecc](https://basescan.org/address/0x8178B76de28E880bb1435346A4c227c0B92Bbecc) | Exact match (creation and runtime) |
| RewardsVault (Earn) | [0x7D317B61055D344c334901976ebAc10450566E6e](https://basescan.org/address/0x7D317B61055D344c334901976ebAc10450566E6e) | Exact match (creation and runtime) |
| FeeManager (fee quotes) | [0xb35Fd984913E99F82c53e47e1013075a187B6d28](https://basescan.org/address/0xb35Fd984913E99F82c53e47e1013075a187B6d28) | Exact match (creation and runtime) |
| AAPLc token | [0xb200000000000000000000C2e324d24d7eEcd1fb](https://basescan.org/address/0xb200000000000000000000C2e324d24d7eEcd1fb) | Issuer token, not part of this repository |

Deployment transactions and block numbers are in [`deployments/base-mainnet-system.json`](deployments/base-mainnet-system.json). The collector that may fund fees is set to AppleFeeVault ([setCollector transaction](https://basescan.org/tx/0x110f650f84e3c611e4b60c05443c4a78a49944c89ea698a9c15c96198ad75ebc)).

Verification records are in [`verification/sourcify-results.json`](verification/sourcify-results.json). Sourcify verification means the published source matches the deployed bytecode. **It is not a security audit.**

The earlier fee-free AppleVault remains at [0xEB8E2ef433aa8dff78940E28049AFf8204866C6C](https://basescan.org/address/0xeb8e2ef433aa8dff78940e28049aff8204866c6c). The website does not use it.

## Repository layout

```
contracts/            Solidity sources, including SplitPoolVault and RewardsVaultV2
deployments/          Deployment records for Base mainnet
verification/         Sourcify results, compiler version, standard JSON input
docs/                 architecture.md, security.md, threat-model.md
scripts/              compile, verification, and mainnet check scripts
packages/sdk/         Note helper for the commitment format
apps/web/             Next.js static site (wagmi + viem), exported to apps/web/out
LICENSE               MIT
```

## Prerequisites

- Node.js 20 or newer (tested with Node 26).
- npm (the repo is an npm workspace).
- A browser wallet that supports Base mainnet, for using the site. Reading the site needs no wallet.

No private keys, seed phrases, or API keys are needed to build, test, or read the site.

## Setup

```bash
npm install
```

### Compile and test the contracts

```bash
npm run compile
npm run test:contracts
```

### Run the website locally

```bash
npm run dev -w apps/web
```

Then open the URL that Next.js prints (usually http://localhost:3000).

### Build the static site

```bash
npm run build:web
```

The output is `apps/web/out/`. It is a static export, so it can be served by any static host. The host must serve `/privacy-stock-source.zip` and `/LICENSE.txt` from the same origin.

## Configuration

Copy `.env.example` to `apps/web/.env.local` only if you need to override a default. Every value is public. Never put a private key or seed phrase in any `NEXT_PUBLIC_` variable, because Next.js inlines these values into the browser bundle.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_BASE_RPC_URL` | `https://mainnet.base.org` | Base RPC used for all reads and for transaction receipts. |
| `NEXT_PUBLIC_REPO_URL` | unset | When set, shows a "GitHub repository" button in the Open source section. Unset means the button is hidden. |

Contract addresses are constants in [`apps/web/lib/contracts.ts`](apps/web/lib/contracts.ts). They match the deployment record. Changing them does not change the deployed contracts.

## Website architecture

| Area | Files | Notes |
| --- | --- | --- |
| Wallet and chain | `apps/web/lib/wagmi.ts`, `components/Providers.tsx`, `components/WalletButton.tsx` | wagmi v3 with EIP-6963 injected wallet discovery. The wallet dialog shows detected wallets. The header shows a "Switch to Base" state when the wallet is on another chain. |
| Live data | `apps/web/lib/useProtocolData.ts` | Reads AAPLc decimals, symbol, and total supply, plus fees collected, eligible principal, escrow total, and the connected account's balance, position, and claimable reward. Refreshes every 15 seconds. Nothing is hardcoded. |
| Commitments | `apps/web/lib/note.ts` | Generates the 32-byte code with `crypto.getRandomValues` and computes `keccak256(code, recipient, vault, chainId)`, the same value `AppleFeeVault.withdraw` checks. |
| Transfer | `components/TransferPanel.tsx` | Validates the amount (8 decimals) and recipient, reads the live fee from FeeManager, shows the review, approves only if the allowance is short, then deposits with the reviewed fee as `maxFee`. |
| Redeem | `components/RedeemPanel.tsx` | Validates the code format, reads `notes(commitment)` to confirm the note exists, then calls `withdraw`. |
| Earn | `components/EarnPanel.tsx` | Deposit, activate, claim, and withdraw principal. Shows the activation countdown. |
| Errors | `lib/errors.ts` | Maps wallet rejections, wrong network, insufficient balance and allowance, and contract custom errors (`NotEligible`, `FeeExceeded`, `NoteMissing`, and others) to plain messages. |
| Theme | `components/ThemeToggle.tsx`, `app/layout.tsx`, `app/globals.css` | Light and dark modes. The saved choice applies before first paint. Storage failures are caught. |
| Photos | `apps/web/public/photos/`, `lib/photos.ts` | Five CC0 or public-domain photos from Wikimedia Commons. Credits are listed in `lib/photos.ts`, not on the page. |
| Motion | `components/CountUp.tsx`, `app/globals.css` | Hero code-to-recipient flow, count-up stats, fee coins flowing into the Earn pool, and scroll reveals. All motion stops under `prefers-reduced-motion`. |

## How each feature works

### Transfer, step by step

1. Enter an amount and a recipient address. The amount is limited to 8 decimals and to your balance.
2. Select **Generate code and quote**. The site reads FeeManager's `quote(amount)` and creates a code locally. Nothing is sent to a server, and nothing is signed yet.
3. Review the fee, the net amount the recipient receives, and the code. Save the code and the recipient address. The site cannot recover the code. **Download note** saves them to a text file.
4. Tick the saved checkbox, then select **Approve AAPLc and deposit**. The site re-reads the fee first. If it rose above your reviewed quote, the site asks you to generate a new quote.
5. If the allowance is below the amount, you approve exactly that amount. Then you sign `deposit(amount, recipient, commitment, fee)`.
6. The transaction is confirmed after two blocks. A reverted transaction is reported as an error, never as a success.

### Redeem, step by step

1. Enter the code and the original recipient address.
2. Select **Check note**. This is a read-only call. It shows the amount and recipient the note holds, or that no active note matches.
3. Select **Withdraw to recipient**. The contract recomputes the commitment from the code and the recipient. Funds go only to that recipient, even if someone else submits the transaction.

### Earn, step by step

1. **Deposit into Earn** approves the amount (if needed) and deposits it as pending principal. Each new deposit restarts the 24-hour activation timer for the pending principal.
2. After the timer ends, **Activate eligible deposit** moves pending principal into eligible principal. Only eligible principal shares fees.
3. Fees arrive in the RewardsVault when fee-charged deposits happen. **Claim rewards** pays out your accrued share.
4. **Withdraw principal** takes pending principal first, then eligible principal. Accrued rewards stay claimable.

## Fees

Fees are progressive on the USD value of each deposit, as implemented in `FeeManager.feeUsdForValue`:

| Deposit value (USD) | Fee rate (marginal) |
| --- | --- |
| Up to $1,000 | 0.50% |
| $1,000 to $10,000 | 1.00% |
| $10,000 to $100,000 | 1.50% |
| Above $100,000 | 2.50% |

The fee is capped at $15,000 per deposit. The AAPLc fee rounds up to the smallest token unit. The price comes from the configured feed. The contract rejects stale or non-positive prices.

On each deposit, 100% of the actual fee moves to the RewardsVault and is allocated to eligible principal. Integer rounding dust stays in the vault.

**Currently, no Earn position is eligible** (the on-chain `eligiblePrincipal` reads 0 at the time of writing). Fee-charged deposits revert until at least one position is active. The site shows this warning in the Transfer panel.

## Security model

- **Public data:** depositor, recipient, amount, fee, and timestamps. Codes are visible in calldata after redemption.
- **Single use:** a redeemed or reclaimed note cannot be withdrawn again.
- **Fixed destination:** the recipient is part of the commitment, so copying a withdrawal transaction cannot redirect funds.
- **Reclaim:** the depositor can reclaim an unredeemed deposit after 90 days. The fee is not refunded.
- **No pause, no upgrades:** the contracts have no pause function and are not proxies.
- **Owner powers:** the RewardsVault owner can change the fee collector. The owner cannot withdraw depositor principal. The owner is `0x7e8ba8a0ed567e1e048d590c27f6e0ce8e90308f`.
- **Issuer risk:** AAPLc issuer eligibility and transfer restrictions apply. A restricted address may be unable to deposit, redeem, or withdraw.
- **Oracle risk:** fee amounts depend on a price feed.

See [`docs/security.md`](docs/security.md) and [`docs/threat-model.md`](docs/threat-model.md) for the full analysis.

## Verification and reproducibility

```bash
npm run compile
npm run test:contracts
node scripts/verify-system.mjs
node scripts/prepare-verification.cjs
npm run build:web
```

- `verify-system.mjs` checks the deployed configuration against this repository and writes `deployments/base-mainnet-system.json`.
- `prepare-verification.cjs` regenerates the standard JSON input and compiler version.
- Local Ganache tests cover progressive fees, escrow replay and recipient binding, and full fee allocation.

Re-check live verification at [Sourcify](https://repo.sourcify.dev/8453/0xb35Fd984913E99F82c53e47e1013075a187B6d28) and [BaseScan](https://basescan.org/). The website shows the verification record from the build date. It does not query Sourcify live.

## Known limits

- The contracts are **unaudited**. Do not describe this project as audited unless an independent audit has been completed and published.
- Earn rewards are variable. They can be zero for long periods.
- The site reads through a public RPC. Use your own RPC with `NEXT_PUBLIC_BASE_RPC_URL` for reliability.
- The one-time code is kept only in browser memory until you reload. Save it before you leave the page.
- The design does not provide ZK privacy. The architecture document explains what a private design would need.

## Contributing and license

Issues and pull requests are welcome. Keep changes to deployed-contract behavior out of frontend pull requests. A contract change needs a new deployment and a new verification record.

Released under the [MIT License](LICENSE).
