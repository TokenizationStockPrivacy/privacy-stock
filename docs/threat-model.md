# Threat model

- **Price validity:** The fee proof must bind the exact feed round, answer, and timestamp, and settlement must reject stale or superseded snapshots. Off-hours or corporate-action feed freezes halt transfers.
- **Amount leakage:** A fee amount, token transfer, gas pattern, deposit, withdrawal, or batch timing can reveal a transfer size or link users. Fee funding needs batching with carefully analyzed anonymity sets.
- **Split evasion:** Marginal rates encourage splitting. A $150,000 transfer costs $2,695; $100,000 + $50,000 costs $2,140. Linking transfers to stop this would weaken privacy, so economics and privacy need joint design.
- **Double spend:** A future pool needs nullifier uniqueness, current Merkle root validation, and proofs of note ownership and value conservation.
- **Issuer controls:** AAPLc B20 policy changes, pause, freeze, seizure, and multiplier updates can affect withdrawals and valuation. A private pool cannot override issuer controls or eligibility rules.
- **Rewards timing:** The 24-hour delay prevents immediate pre-funding deposits, but a predictable collector funding schedule can still be gamed. A production scheme needs adversarial testing and potentially epoch accounting.
- **Custody:** Actual AAPLc rights and backing depend on issuer and custodian. A smart contract cannot independently prove offchain shares exist.
