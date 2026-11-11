import { createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';

/**
 * Public Base RPC for reads. Set NEXT_PUBLIC_BASE_RPC_URL to use your own endpoint.
 * This value is public by design: never put a private key or secret here.
 */
export const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

export const wagmiConfig = createConfig({
  chains: [base],
  // EIP-6963 discovers extension wallets such as Rabby and MetaMask.
  // Coinbase Wallet also works when this page is opened in a browser without extensions.
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: 'Privacy Stock',
      appLogoUrl: '/icon.svg',
    }),
  ],
  ssr: true,
  transports: {
    [base.id]: http(RPC_URL),
  },
});
