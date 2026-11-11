/**
 * Build-time record of Sourcify verification, copied from verification/sourcify-results.json.
 * Sourcify confirms that published source matches deployed bytecode. It is not a security audit.
 * Re-check live status at repo.sourcify.dev before relying on it.
 */
export const VERIFICATION_RECORD = {
  checkedAt: '2026-11-11',
  source: 'verification/sourcify-results.json',
  contracts: {
    SplitPoolVault: { match: 'pending_sourcify', creationMatch: 'local_exact', runtimeMatch: 'local_exact', verifiedAt: '2026-11-11T10:30:00Z' },
    RewardsVaultV2: { match: 'pending_sourcify', creationMatch: 'local_exact', runtimeMatch: 'local_exact', verifiedAt: '2026-11-11T10:30:00Z' },
    AppleFeeVault: { match: 'exact_match', creationMatch: 'exact_match', runtimeMatch: 'exact_match', verifiedAt: '2026-11-10T19:22:34Z' },
    RewardsVault: { match: 'exact_match', creationMatch: 'exact_match', runtimeMatch: 'exact_match', verifiedAt: '2026-11-10T19:22:29Z' },
    FeeManager: { match: 'exact_match', creationMatch: 'exact_match', runtimeMatch: 'exact_match', verifiedAt: '2026-11-10T19:22:26Z' },
  },
} as const;

export type VerifiedName = keyof typeof VERIFICATION_RECORD.contracts;
