# Privacy Stock

Open-source AAPLc code escrow and fee-sharing application on Base mainnet.

> **Unaudited. Not private.** Depositors, recipients, amounts, and fees are public on-chain. A one-time code becomes public when it is used. This is not a zero-knowledge privacy pool and not an investment product. No independent security audit has been completed.

## Split pool V2 (live on Base mainnet)

V2 adds `SplitPoolVault` and `RewardsVaultV2`:

- Deposit AAPLc into one reusable pool balance.
- Split that balance into any number of independent fixed-recipient notes. One transaction can create up to 100 notes—for example, 1 AAPLc as 100 gross 0.01 AAPLc notes with separate recipients and codes. Additional batches can create more.
- Each note deducts the quoted protocol fee from its gross amount.
- Note creation does not pause when Earn is empty. Fees remain backed in `SplitPoolVault` and are flushed when an Earn position exists.
- Earn principal is eligible immediately. This removes the V1 delay but introduces fee-sniping risk.

The deployment and configuration are recorded in [`deployments/base-mainnet-v2.json`](deployments/base-mainnet-v2.json). The creation transactions exactly match the locally compiled bytecode and constructor arguments.

## What it does

1. **Pool and split.** Deposit AAPLc once into a reusable balance, then create up to 100 independent fixed-recipient notes per transaction. Every note receives a separate browser-generated code and redeems once.
2. **Redeem.** The recipient (or anyone with the code) enters the code and the original recipient address. The site reads the note first, so you see the amount and recipient before you pay gas.
3. **Earn.** Deposited principal becomes eligible immediately and shares future note fees in proportion to principal. Rewards depend on real fee activity and other positions. No yield is promised. Immediate eligibility permits fee sniping.

## Live deployment (Base mainnet, chain 8453)

| Contract | Address | Sourcify status (checked 2026-11-10) |
| --- | --- | --- |
| SplitPoolVault V2 | [0x3E2b92a2b515a4cF3aFbe82FA92BD0802303C89C](https://basescan.org/address/0x3E2b92a2b515a4cF3aFbe82FA92BD0802303C89C) | Local creation bytecode exact match; Sourcify pending |
| RewardsVaultV2 | [0x7EDe3DFe8347bfab5e89fa109F2C091fBFaB278a](https://basescan.org/address/0x7EDe3DFe8347bfab5e89fa109F2C091fBFaB278a) | Local creation bytecode exact match; Sourcify pending |
| AppleFeeVault (escrow) | [0x8178B76de28E880bb1435346A4c227c0B92Bbecc](https://basescan.org/address/0x8178B76de28E880bb1435346A4c227c0B92Bbecc) | Exact match (creation and runtime) |
| RewardsVault (Earn) | [0x7D317B61055D344c334901976ebAc10450566E6e](https://basescan.org/address/0x7D317B61055D344c334901976ebAc10450566E6e) | Exact match (creation and runtime) |
| FeeManager (fee quotes) | [0xb35Fd984913E99F82c53e47e1013075a187B6d28](https://basescan.org/address/0xb35Fd984913E99F82c53e47e1013075a187B6d28) | Exact match (creation and runtime) |
| AAPLc token | [0xb200000000000000000000C2e324d24d7eEcd1fb](https://basescan.org/address/0xb200000000000000000000C2e324d24d7eEcd1fb) | Issuer token, not part of this repository |

V2 deployment transactions and block numbers are in [`deployments/base-mainnet-v2.json`](deployments/base-mainnet-v2.json). V1 remains recorded in [`deployments/base-mainnet-system.json`](deployments/base-mainnet-system.json) as a legacy deployment and is no longer used by the website.

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
| Commitments | `apps/web/lib/note.ts` | Generates the 32-byte code with `crypto.getRandomValues` and computes `keccak256(code, recipient, vault, chainId)`, the same value `SplitPoolVault.redeem` checks. |
| Pool and split | `components/TransferPanel.tsx` | Funds a reusable pool balance, parses 1–100 recipient/amount rows, quotes every fee, generates separate codes, and creates the batch atomically. |
| Redeem | `components/RedeemPanel.tsx` | Validates the code format, reads `notes(commitment)` to confirm the note exists, then calls `redeem`. |
| Earn | `components/EarnPanel.tsx` | Deposit, claim, and withdraw principal with immediate eligibility and no activation transaction. |
| Errors | `lib/errors.ts` | Maps wallet rejections, wrong network, insufficient balance and allowance, and contract custom errors (`NotEligible`, `FeeExceeded`, `NoteMissing`, and others) to plain messages. |
| Theme | `components/ThemeToggle.tsx`, `app/layout.tsx`, `app/globals.css` | Light and dark modes. The saved choice applies before first paint. Storage failures are caught. |
| Photos | `apps/web/public/photos/`, `lib/photos.ts` | Five CC0 or public-domain photos from Wikimedia Commons. Credits are listed in `lib/photos.ts`, not on the page. |
| Motion | `components/CountUp.tsx`, `app/globals.css` | Hero code-to-recipient flow, count-up stats, fee coins flowing into the Earn pool, and scroll reveals. All motion stops under `prefers-reduced-motion`. |

## How each feature works

### Pool and split, step by step

1. Approve and deposit AAPLc into your reusable `poolBalance`.
2. Enter one line per withdrawal as `recipient, amount`, up to 100 lines per batch.
3. The site quotes every fee and generates an independent code and commitment locally for every line.
4. Save every code, then sign `createNotes`. The transaction atomically debits the gross amounts and creates all notes.
5. Each recipient receives its note's gross amount minus that note's fee. Additional batches can create more than 100 notes.

### Redeem, step by step

1. Enter the code and the original recipient address.
2. Select **Check note**. This is a read-only call. It shows the amount and recipient the note holds, or that no active note matches.
3. Select **Withdraw to recipient**. The contract recomputes the commitment from the code and the recipient. Funds go only to that recipient, even if someone else submits the transaction.

### Earn, step by step

1. **Deposit into Earn** approves the amount (if needed) and makes the principal eligible immediately.
2. Fees reach `RewardsVaultV2` when notes are created while principal exists. Fees created while Earn is empty remain in `SplitPoolVault.pendingFees` until they can be flushed.
3. **Claim rewards** pays the account's accrued share. **Withdraw principal** removes any selected amount immediately.

## Fees

Fees are progressive on the USD value of each deposit, as implemented in `FeeManager.feeUsdForValue`:

| Deposit value (USD) | Fee rate (marginal) |
| --- | --- |
| Up to $1,000 | 0.50% |
| $1,000 to $10,000 | 1.00% |
| $10,000 to $100,000 | 1.50% |
| Above $100,000 | 2.50% |

The fee is capped at $15,000 per deposit. The AAPLc fee rounds up to the smallest token unit. The price comes from the configured feed. The contract rejects stale or non-positive prices.

On each V2 note, 100% of the actual fee is allocated to RewardsVaultV2 when Earn has principal; otherwise it remains backed as a pending fee in SplitPoolVault. Integer rounding dust stays in the rewards vault.

V2 note creation never pauses while Earn is empty. Fees remain backed in `SplitPoolVault.pendingFees` and are flushed after an Earn position exists.

## Security model

- **Public data:** depositor, recipient, amount, fee, and timestamps. Codes are visible in calldata after redemption.
- **Single use:** a redeemed or reclaimed note cannot be withdrawn again.
- **Fixed destination:** the recipient is part of the commitment, so copying a withdrawal transaction cannot redirect funds.
- **Reclaim:** the depositor can reclaim an unredeemed deposit after 90 days. The fee is not refunded.
- **No pause, no upgrades:** the contracts have no pause function and are not proxies.
- **Owner powers:** the RewardsVaultV2 owner can change the fee collector. The owner cannot withdraw pool balances, notes, or Earn principal. The owner is `0x7e8ba8a0ed567e1e048d590c27f6e0ce8e90308f`.
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
