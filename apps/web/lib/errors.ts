/**
 * Turns wallet and contract errors into messages a person can act on.
 * Matches custom error names emitted by the deployed contracts.
 */
const CONTRACT_ERRORS: Array<[RegExp, string]> = [
  [/NotEligible/, 'No Earn position is active yet. Fee-charged deposits resume once at least one position is activated.'],
  [/FeeExceeded/, 'The fee moved above the quote you reviewed. Generate a new quote and review it again.'],
  [/NoteMissing/, 'No active note matches this code and recipient. It may already be redeemed or reclaimed.'],
  [/TooEarly/, 'This deposit can only be reclaimed 90 days after it was made.'],
  [/NotDepositor/, 'Only the original depositor can reclaim this note.'],
  [/InsufficientShares/, 'That amount is larger than your principal.'],
  [/UnauthorizedCollector/, 'Fee collection is not available right now. Try again later.'],
  [/UnsupportedToken/, 'The AAPLc transfer did not behave as expected. Nothing was changed.'],
  [/InvalidDeposit/, 'This deposit was rejected. Check the amount, recipient, and code, then try again.'],
  [/ERC20InsufficientAllowance|allowance/i, 'The AAPLc approval is too low. Approve again and retry.'],
  [/ERC20InsufficientBalance|exceeds balance/i, 'Your AAPLc balance is lower than this amount.'],
  [/insufficient funds/i, 'Your wallet needs more ETH on Base to pay the network fee.'],
];

export function friendlyError(error: unknown): string {
  if (!error) return 'Something went wrong. Nothing was confirmed on-chain.';
  const e = error as { name?: string; code?: number; shortMessage?: string; message?: string };
  if (e.code === 4001 || e.name === 'UserRejectedRequestError' || /user (rejected|denied)/i.test(e.message ?? '')) {
    return 'You cancelled the request in your wallet. Nothing was sent.';
  }
  if (/chain mismatch|does not match the target chain|wrong network/i.test(e.message ?? '')) {
    return 'Your wallet is on the wrong network. Switch to Base mainnet and try again.';
  }
  const raw = `${e.shortMessage ?? ''} ${e.message ?? ''}`;
  for (const [pattern, text] of CONTRACT_ERRORS) {
    if (pattern.test(raw)) return text;
  }
  const fallback = (e.shortMessage || e.message || 'Something went wrong.').split('\n')[0];
  return fallback.length > 220 ? `${fallback.slice(0, 217)}…` : fallback;
}
