# Privacy v2: scope and open decisions

Status: **ZK privacy scoping only. Nothing in this document is implemented or deployed.** The live split-pool contracts (`SplitPoolVault`, `RewardsVaultV2`, and `FeeManager`) are immutable and do not hide sender, recipient, amount, or fee. "V2" in the live product means the split-balance upgrade, not a ZK privacy release.

## 1. Goal

Let a user send AAPLc so that an outside observer on Base cannot link the depositor to the recipient, and cannot read the amount from the deposit or the withdrawal.

This is a new protocol, not an upgrade. Existing deployments cannot be changed to do it.

## 2. What privacy requires

| Requirement | Why it is hard here |
| --- | --- |
| Shielded pool: deposits create notes, withdrawals spend them with a ZK proof | Needs circuits, a proving system, and usually a trusted setup or a transparent system with larger proofs. |
| Hidden amounts | The pool must keep balances conserved without revealing per-note values. |
| Private fees | The architecture doc notes that a token-denominated fee transfer exposes an amount. Fees must be batched or shielded too. |
| Oracle-bound fee quotes | The fee must be proven against the same price round the protocol accepts, without replay. |
| Withdrawal without a public link | Withdrawals must not reveal which deposit they spend, beyond what a proof shows. |

## 3. Compliance constraints (must be answered before building)

AAPLc is a Coinbase-issued, eligibility-restricted token. Any design that hides who transfers it may conflict with issuer controls, sanctions screening, or securities rules. These questions need legal input:

1. Can the issuer's eligibility rules be enforced inside a shielded pool? (For example, through association sets or selective disclosure to a verifier.)
2. Who is allowed to deposit and withdraw? Is the pool open to anyone, or limited to eligible addresses?
3. How does the design handle sanctions screening and AML obligations for a privacy pool?
4. Would the issuer freeze or blocklist pool contracts? How would that affect users' funds?

Until these are answered, this project should not accept user funds under a privacy label.

## 4. Candidate architectures

- **A. Shielded pool with association sets.** Deposits go into a Merkle tree. Withdrawals prove membership and a valid association set (an allowed subset of deposits). Closest to the Privacy Pools design. Needs a compliance-approved set-maintenance process.
- **B. Batched fee settlement only.** Keep the existing escrow for the transfer and add private fee notes. Smaller change, but the transfer itself stays public, so it does not deliver the goal.
- **C. Stay public, be honest.** Keep the current contracts and rename or disclose clearly. No new cost or risk.

Recommended: **C now**, and **A** only if the compliance questions have acceptable answers.

## 5. Work required for A

1. Written threat model and compliance memo (legal, not engineering).
2. Circuit design and proving-system choice, with security review of the circuits.
3. New contracts: pool, verifier, fee handling, Earn integration.
4. Test suite covering double-spend, replay, reorgs, oracle staleness, and fee conservation.
5. Independent security audit of contracts and circuits.
6. Public trusted-setup ceremony if the proving system needs one.
7. Migration plan: how existing users move funds, and what happens to the old contracts.
8. Frontend changes: client-side note storage, proof generation, and clear risk copy.

## 6. Frontend changes that depend on the decision

- **If C:** rename the product, remove "Privacy" from the name, footer, and metadata, and keep the not-private disclosures.
- **If A:** no UI privacy claims until the audit is published and the compliance memo is approved.

## 7. Open decisions for the owner

1. Do you want option C (honest rename) now?
2. Is option A in scope, and who will fund the audit and legal review?
3. Who has authority to approve the compliance memo?
