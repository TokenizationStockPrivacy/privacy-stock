import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '../components/Providers';

export const metadata: Metadata = {
  title: 'Privacy Stock | AAPLc code escrow on Base',
  description:
    'Open-source AAPLc code escrow and fee-sharing on Base mainnet. Unaudited. Transactions are public on-chain, and this is not a privacy pool.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#070C16' },
    { media: '(prefers-color-scheme: light)', color: '#F5F7FB' },
  ],
};

/**
 * Runs before first paint so a saved theme never flashes.
 * localStorage can throw in private windows or when blocked, so the read is wrapped.
 */
const themeScript = `(function(){try{var t=localStorage.getItem('ps-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;600&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
