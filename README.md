# Privacy Stock

Public, unaudited AAPLc code escrow and fee-funded Earn vault on Base mainnet. The live website is [privacy-stock-aaplc.rijan-b-hattarai9988.chatgpt.site](https://privacy-stock-aaplc.rijan-b-hattarai9988.chatgpt.site). **This is not a ZK privacy pool.** Depositor, recipient, amount, and fee are public; the code is public when used for withdrawal.

The complete MIT-licensed source is [publicly downloadable from the website](https://privacy-stock-aaplc.rijan-b-hattarai9988.chatgpt.site/privacy-stock-source.zip). All three contracts have an [exact Sourcify match](https://docs.sourcify.dev/docs/api/) for both creation and runtime bytecode: [FeeManager](https://repo.sourcify.dev/8453/0xb35Fd984913E99F82c53e47e1013075a187B6d28), [RewardsVault](https://repo.sourcify.dev/8453/0x7D317B61055D344c334901976ebAc10450566E6e), and [AppleFeeVault](https://repo.sourcify.dev/8453/0x8178B76de28E880bb1435346A4c227c0B92Bbecc). Source verification is not a security audit.

## Mainnet contracts

| Contract | Address | Deployment transaction |
| --- | --- | --- |
| FeeManager | [0xb35Fd984913E99F82c53e47e1013075a187B6d28](https://basescan.org/address/0xb35fd984913e99f82c53e47e1013075a187b6d28) | [0x766a…07b5](https://basescan.org/tx/0x766a8de621fad6171474fc0dd26d20d382dc892bab86f17d925cf26702ff07b5) |
| RewardsVault | [0x7D317B61055D344c334901976ebAc10450566E6e](https://basescan.org/address/0x7d317b61055d344c334901976ebac10450566e6e) | [0x0352…a153](https://basescan.org/tx/0x0352c11be07e05168518e6eec9ac5aacd6603a8f6adbfbc1f628a8c84632a153) |
| AppleFeeVault | [0x8178B76de28E880bb1435346A4c227c0B92Bbecc](https://basescan.org/address/0x8178b76de28e880bb1435346a4c227c0b92bbecc) | [0x166d…504c](https://basescan.org/tx/0x166dc59413c8f6b1a572607ac72cf8c88852d0d504957b68e9c76b290f52504c) |

[Collector assignment](https://basescan.org/tx/0x110f650f84e3c611e4b60c05443c4a78a49944c89ea698a9c15c96198ad75ebc) restricts fee funding to AppleFeeVault. The deployment transaction input and contract configuration were verified against this repository with `node scripts/verify-system.mjs`; the result is in `deployments/base-mainnet-system.json`. The earlier standalone fee-free AppleVault remains at [0xEB8E2ef433aa8dff78940E28049AFf8204866C6C](https://basescan.org/address/0xeb8e2ef433aa8dff78940e28049aff8204866c6c).

## Use

1. Connect an EVM wallet on Base mainnet at the live site. You need eligible [Coinbase AAPLc](https://www.base.org/stocks) and ETH for gas.
2. To earn fees, deposit AAPLc into Earn, wait 24 hours, then activate. At least one eligible position must exist before fee-charged transfer deposits can succeed.
3. To send AAPLc, enter the amount and fixed recipient. The website generates a random 32-byte code locally and quotes the current Chainlink feed. Save the code and recipient address, approve AAPLc, and submit the deposit.
4. A wallet holding the code can submit withdrawal, but the AAPLc goes to the fixed recipient. The code is revealed in transaction calldata. A depositor can reclaim an unredeemed note after 90 days; the fee is not refunded.
5. Earn participants can claim accrued AAPLc fees and withdraw principal. Rewards depend on actual transfer volume and eligible principal; no return is promised.

Fees are progressive on USD value: 0.5% up to $1,000, 1% from $1,000 to $10,000, 1.5% from $10,000 to $100,000, and 2.5% above $100,000, capped at $15,000. AAPLc token fees round up to the smallest token unit. Quotes require the configured [AAPLc total-return feed](https://docs.base.org/build-on-base/integrate-defi/list-tokenized-stocks) to be no older than 36 hours. The website caps the submitted fee at the quote the user reviewed. 100% of the actual token fee is transferred to RewardsVault and allocated to currently eligible positions, subject to integer dust.

## Build and verify

```sh
npm install
npm run compile
npm run test:contracts
node scripts/verify-system.mjs
node scripts/prepare-verification.cjs
npm run build:web
npm run dev -w apps/web
```

The website is a static Next.js export in `apps/web/out` and uses an injected EVM wallet plus Base RPC. The contracts use OpenZeppelin and Solidity 0.8.38. Local Ganache tests cover progressive fees, escrow replay/recipient binding, and full actual fee allocation.

`verification/standard-input.json` contains every Solidity source and the exact compiler settings used for deployment. `scripts/prepare-verification.cjs` rebuilds that input and checks that the resulting creation bytecode matches the original compilation. `scripts/verify-system.mjs` compares each deployment transaction with the compiled creation data and reads the live configuration. `verification/sourcify-results.json` records independent exact-match results from Sourcify. `scripts/verify-sourcify.mjs` can resubmit source verification if needed. BaseScan's automated submission reached its daily limit during verification; Sourcify verification succeeded.

## Limits

- There is no zero-knowledge circuit, verifier, shielded transfer, encrypted note discovery, or transaction privacy.
- The contracts and website have not been audited or formally verified. Do not rely on them for valuable assets.
- AAPLc issuer eligibility, transfer controls, freezes, and corporate-action behavior can affect transfers. Review issuer terms. The [AAPLc prospectus](https://api.coinbase.com/v1/tokenized-stocks/prospectus/AAPLc.pdf) was not retrievable during development.
- The code is generated in the browser and is not backed up. A lost code can prevent recipient withdrawal until the depositor's 90-day reclaim window.
- Fees may be split across transfers to reduce the effective rate. The rewards vault cannot guarantee an APY.

MIT licensed.
