import type { Metadata } from 'next';
import { DeployV2 } from '../../components/DeployV2';

export const metadata: Metadata = {
  title: 'Deploy Split Pool V2 | Privacy Stock',
  description: 'Deploy the open-source split-balance AAPLc pool contracts on Base mainnet.',
};

export default function DeployV2Page() {
  return <DeployV2 />;
}
