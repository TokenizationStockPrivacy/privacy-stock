'use client';
import { useReadContract } from 'wagmi';
import type { Address } from 'viem';
import { useCallback } from 'react';
import { AAPLC_TOKEN, APPLE_FEE_VAULT, BASE_CHAIN_ID, CONTRACTS, REWARDS_VAULT, erc20Abi } from './contracts';

const REFRESH_MS = 15_000;

export type Position = { pending: bigint; eligible: bigint; unlockAt: bigint };

/**
 * Live on-chain reads for the dashboard. Nothing here is hardcoded.
 * Token metadata (decimals, symbol) is read from AAPLc itself.
 */
export function useProtocolData(account?: Address) {
  const chainId = BASE_CHAIN_ID;

  const decimals = useReadContract({
    address: AAPLC_TOKEN, abi: erc20Abi, functionName: 'decimals', chainId,
    query: { staleTime: Infinity },
  });
  const symbol = useReadContract({
    address: AAPLC_TOKEN, abi: erc20Abi, functionName: 'symbol', chainId,
    query: { staleTime: Infinity },
  });
  const totalSupply = useReadContract({
    address: AAPLC_TOKEN, abi: erc20Abi, functionName: 'totalSupply', chainId,
    query: { refetchInterval: REFRESH_MS },
  });
  const feesCollected = useReadContract({
    address: REWARDS_VAULT, abi: CONTRACTS.RewardsVault.abi, functionName: 'totalFeesReceived', chainId,
    query: { refetchInterval: REFRESH_MS },
  });
  const eligiblePrincipal = useReadContract({
    address: REWARDS_VAULT, abi: CONTRACTS.RewardsVault.abi, functionName: 'eligiblePrincipal', chainId,
    query: { refetchInterval: REFRESH_MS },
  });
  const escrowLocked = useReadContract({
    address: APPLE_FEE_VAULT, abi: CONTRACTS.AppleFeeVault.abi, functionName: 'totalLocked', chainId,
    query: { refetchInterval: REFRESH_MS },
  });
  const balance = useReadContract({
    address: AAPLC_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: account ? [account] : undefined, chainId,
    query: { enabled: !!account, refetchInterval: REFRESH_MS },
  });
  const position = useReadContract({
    address: REWARDS_VAULT, abi: CONTRACTS.RewardsVault.abi, functionName: 'positions', args: account ? [account] : undefined, chainId,
    query: { enabled: !!account, refetchInterval: REFRESH_MS },
  });
  const pendingReward = useReadContract({
    address: REWARDS_VAULT, abi: CONTRACTS.RewardsVault.abi, functionName: 'pendingReward', args: account ? [account] : undefined, chainId,
    query: { enabled: !!account, refetchInterval: REFRESH_MS },
  });

  const publicReads = [decimals, symbol, totalSupply, feesCollected, eligiblePrincipal, escrowLocked];
  const accountReads = [balance, position, pendingReward];
  const reads = account ? [...publicReads, ...accountReads] : publicReads;

  // Refetches only the queries that are enabled. Disabled account queries have no address to read.
  const refetch = useCallback(async () => {
    await Promise.all(reads.map((r) => r.refetch()));
    // `reads` is rebuilt on each render; the closure always sees the current enabled set.
  }, [reads]);

  const pos = position.data as readonly [bigint, bigint, bigint, bigint, bigint] | undefined;

  return {
    decimals: decimals.data !== undefined ? Number(decimals.data) : 8,
    symbol: (symbol.data as string | undefined) ?? 'AAPLc',
    totalSupply: totalSupply.data as bigint | undefined,
    feesCollected: feesCollected.data as bigint | undefined,
    eligiblePrincipal: eligiblePrincipal.data as bigint | undefined,
    escrowLocked: escrowLocked.data as bigint | undefined,
    balance: balance.data as bigint | undefined,
    position: pos
      ? ({ pending: pos[0], eligible: pos[1], unlockAt: pos[2] } as Position)
      : undefined,
    pendingReward: pendingReward.data as bigint | undefined,
    loadError: reads.find((r) => r.isError)?.error,
    isLoading: reads.some((r) => r.isPending && r.fetchStatus !== 'idle'),
    refetch,
  };
}
