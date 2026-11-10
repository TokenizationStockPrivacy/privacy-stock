# Architecture status

The current implementation has **three independent contracts**, not an integrated private stock-transfer protocol.

`AppleVault` is a public escrow. It accepts only the configured ERC-20, and on Base mainnet its constructor enforces the official AAPLc address. Each deposit stores the amount, depositor, fixed recipient, and 90-day recovery time under a one-time commitment. Withdrawal proves knowledge of a random secret in calldata. Since the recipient is part of the commitment, copying the withdrawal transaction cannot redirect assets. The depositor can reclaim after the deadline. This has no ZK privacy or fee integration.

`FeeManager` binds an immutable token, feed, and maximum oracle age. It normalizes a positive feed answer to 8-decimal USD, calculates a marginal fee, and converts that fee back to token units with upward rounding. A caller can inspect the oracle round and `updatedAt` returned by `quote`. A future ZK proof must constrain the exact same price, round, token decimals, chain ID, pool address, note input value, outputs, and fee, then verify that the quoted round is still current in the settlement transaction. Otherwise price changes or proof replay can break conservation.

`RewardsVault` holds principal and collected fees in the same ERC-20 but tracks them as separate liabilities. Fee funding pulls tokens from an authorized collector; it does not issue rewards from private backing. Pending deposits activate after one day and cannot claim earlier allocations. A user may withdraw principal while preserving accrued rewards. Rounding dust stays in the vault. The collector must batch fee funding to avoid revealing a private transfer's fee through an event or token transfer.

This is **not** sufficient for privacy. Direct onchain transfer of a token-denominated fee exposes an amount. A viable pool requires shielded fee notes or batching plus a ZK verified conversion that maintains backing without revealing per-transfer values. It must also support selective disclosure consistent with the AAPLc issuer's restrictions. Until those pieces exist, no asset-taking deployment is appropriate.
