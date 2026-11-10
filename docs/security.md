# Security status

No audit has been performed. Contracts compile with `solc` 0.8.38 and one local EVM integration test passes. They are research code.

The rewards vault and public escrow reject fee-on-transfer behavior by checking the actual balance delta, and both use SafeERC20 and reentrancy guards. The escrow binds the payout recipient and contract/chain context to a one-time commitment; the secret is public after withdrawal, so it must never be reused. Human-chosen passwords are vulnerable to offline guessing. The rewards collector role uses two-step ownership. The fee contract rejects stale, future, zero, and negative feed values. Token deposits are delayed before reward eligibility. The public escrow was deployed on Base mainnet, but no asset transactions have been made through it.

Unproven properties include aggregate reward solvency under all sequences and rounding edge cases, behavior with malicious ERC-20 implementations, governance compromise, issuer transfer freezes, oracle manipulation, and all privacy claims. The fee quote is not proof constrained. Local tests do not substitute for Foundry fuzzing, invariants, or an external audit.
