import type { Metadata } from 'next';
import { LegacyV1Recovery } from '../../components/LegacyV1Recovery';

export const metadata: Metadata = { title: 'Legacy V1 Recovery | Privacy Stock' };

export default function LegacyV1Page() { return <LegacyV1Recovery />; }
