import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {title:'Privacy Stock | AAPLc code escrow on Base',description:'Public AAPLc code escrow and fee-funded Earn vault on Base mainnet. Unaudited; transactions are visible on-chain.'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
