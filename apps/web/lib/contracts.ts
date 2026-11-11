import type { Abi, Address } from 'viem';
import feeManagerArtifact from './artifacts/FeeManager.json';
import rewardsVaultArtifact from './artifacts/RewardsVault.json';
import appleFeeVaultArtifact from './artifacts/AppleFeeVault.json';
import rewardsVaultV2Artifact from './artifacts/RewardsVaultV2.json';
import splitPoolVaultArtifact from './artifacts/SplitPoolVault.json';

/** Base mainnet chain id. */
export const BASE_CHAIN_ID = 8453;

/** Coinbase AAPLc token on Base mainnet. Decimals are read on-chain at runtime. */
export const AAPLC_TOKEN = '0xb200000000000000000000C2e324d24d7eEcd1fb' as Address;

/** Chainlink-style USD price feed used by FeeManager (set at deployment). */
export const PRICE_FEED = '0x787f13dEa48Db0897CbCDD985de77809D837F988' as Address;

/** The three deployed contracts. Addresses match deployments/base-mainnet-system.json. */
export const CONTRACTS = {
  SplitPoolVault: {
    address: '0x3E2b92a2b515a4cF3aFbe82FA92BD0802303C89C' as Address,
    deployTx: '0xc323d8b54c2b898bf0eee8a754c15440d144808aad8b50d36d6674b2433191fe',
    abi: splitPoolVaultArtifact.abi as Abi,
  },
  RewardsVaultV2: {
    address: '0x7EDe3DFe8347bfab5e89fa109F2C091fBFaB278a' as Address,
    deployTx: '0xe8dd98e7eff893769ffd05dff5839dc6f860cbbb45e95956b1ee2d20637a4ebf',
    abi: rewardsVaultV2Artifact.abi as Abi,
  },
  AppleFeeVault: {
    address: '0x8178B76de28E880bb1435346A4c227c0B92Bbecc' as Address,
    deployTx: '0x166dc59413c8f6b1a572607ac72cf8c88852d0d504957b68e9c76b290f52504c',
    abi: appleFeeVaultArtifact.abi as Abi,
  },
  RewardsVault: {
    address: '0x7D317B61055D344c334901976ebAc10450566E6e' as Address,
    deployTx: '0x0352c11be07e05168518e6eec9ac5aacd6603a8f6adbfbc1f628a8c84632a153',
    abi: rewardsVaultArtifact.abi as Abi,
  },
  FeeManager: {
    address: '0xb35Fd984913E99F82c53e47e1013075a187B6d28' as Address,
    deployTx: '0x766a8de621fad6171474fc0dd26d20d382dc892bab86f17d925cf26702ff07b5',
    abi: feeManagerArtifact.abi as Abi,
  },
} as const;

export const APPLE_FEE_VAULT = CONTRACTS.AppleFeeVault.address;
export const SPLIT_POOL_VAULT = CONTRACTS.SplitPoolVault.address;
export const REWARDS_VAULT = CONTRACTS.RewardsVaultV2.address;
export const FEE_MANAGER = CONTRACTS.FeeManager.address;

/** Minimal ERC-20 surface used by the app. */
export const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const satisfies Abi;

export const basescanAddress = (a: string) => `https://basescan.org/address/${a}`;
export const basescanTx = (h: string) => `https://basescan.org/tx/${h}`;
export const sourcifyRepo = (a: string) => `https://repo.sourcify.dev/${BASE_CHAIN_ID}/${a}`;
