import { formatUnits, parseUnits } from 'viem';

/** AAPLc uses 8 decimals (read from the token contract; see the Token info card). */
export const AAPLC_DECIMALS = 8;

const AMOUNT_PATTERN = /^\d+(\.\d{1,8})?$/;

/**
 * Parses a user-entered AAPLc amount into base units.
 * Throws a readable Error when the input is empty, malformed, or zero.
 */
export function parseAmount(input: string, decimals: number = AAPLC_DECIMALS): bigint {
  const trimmed = input.trim();
  if (trimmed === '') throw new Error('Enter an AAPLc amount.');
  if (!AMOUNT_PATTERN.test(trimmed)) {
    throw new Error(`Use a plain number with up to ${decimals} decimal places.`);
  }
  const value = parseUnits(trimmed, decimals);
  if (value <= BigInt(0)) throw new Error('The amount must be greater than zero.');
  return value;
}

/** Formats base units as a human-readable AAPLc string without trailing noise. */
export function formatAaplc(value: bigint | undefined, decimals: number = AAPLC_DECIMALS, maxFractionDigits = 4): string {
  if (value === undefined) return '–';
  const n = Number(formatUnits(value, decimals));
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits });
}

/** Display formatter for animated numbers. */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

/** Converts base units to a JS number for animation only. Never use this value for signing. */
export function toNumber(value: bigint | undefined, decimals: number = AAPLC_DECIMALS): number | undefined {
  return value === undefined ? undefined : Number(formatUnits(value, decimals));
}

/** Full-precision formatter for amounts the user is about to sign. */
export function formatExact(value: bigint, decimals: number = AAPLC_DECIMALS): string {
  return formatUnits(value, decimals);
}

export function shortAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return 'Ready';
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}
