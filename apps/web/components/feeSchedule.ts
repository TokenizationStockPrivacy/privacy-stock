/**
 * Fee tiers as implemented in FeeManager.feeUsdForValue (marginal, progressive on USD value).
 * Kept here for display only. The contract is the source of truth, and the website always shows the live quote.
 */
export const FEE_SCHEDULE = {
  tiers: [
    { upToUsd: 1_000, rate: '0.50%' },
    { upToUsd: 10_000, rate: '1.00%' },
    { upToUsd: 100_000, rate: '1.50%' },
    { upToUsd: Infinity, rate: '2.50%' },
  ],
  capUsd: 15_000,
  summary:
    'Fees are progressive on the USD value of each deposit: 0.5% up to $1,000, 1% from $1,000 to $10,000, 1.5% from $10,000 to $100,000, and 2.5% above that, capped at $15,000 per deposit. The AAPLc fee is rounded up to the smallest token unit.',
} as const;
