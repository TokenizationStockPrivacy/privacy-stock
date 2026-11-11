import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',
  // Local users often open the preview by IP instead of "localhost".
  // Without this, Next.js blocks the development client and buttons never hydrate.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

export default config;
