# Split pool V2

V2 separates funding from note creation. `depositToPool` credits a reusable on-chain balance. `createNote` removes a caller-selected gross amount from that balance and creates a fixed-recipient note. `createNotes` creates up to 100 independent notes atomically. A single 1 AAPLc balance can therefore create 100 gross 0.01 AAPLc notes with different commitments, recipients, and codes; additional transactions can create further batches.

The progressive fee is quoted for each note and deducted from that note's gross amount. Two gross 0.5 notes consume exactly 1 AAPLc of pool balance, while each recipient receives 0.5 minus that note's fee.

`SplitPoolVault` does not depend on an active Earn position. If Earn is empty, fees accumulate in `pendingFees`; principal and fee accounting remain backed by the contract's AAPLc balance. When an Earn position exists, `flushFees` sends all pending fees to `RewardsVaultV2`.

`RewardsVaultV2` makes new principal eligible immediately. This satisfies immediate-use requirements but permits fee sniping: an account can enter just before a large fee and leave afterward. Rewards remain variable and may be zero.

## Security properties

- Notes are single-use and bind the secret, recipient, vault address, and chain ID.
- Anyone may relay a valid code, but payout always goes to its committed recipient.
- Unallocated pool balance can only be withdrawn by its owner.
- An unredeemed note can be reclaimed after 90 days; its net amount returns to the depositor's pool balance. Its fee is not refunded.
- Depositors, balances, recipients, amounts, fees, codes used in calldata, and redemptions are public.
- The contracts are immutable and unaudited.
