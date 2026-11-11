import { EarnPanel } from '../components/EarnPanel';
import { Footer } from '../components/Footer';
import { Hero } from '../components/Hero';
import { HowItWorks } from '../components/HowItWorks';
import { OpenSource } from '../components/OpenSource';
import { RedeemPanel } from '../components/RedeemPanel';
import { Security } from '../components/Security';
import { SiteHeader } from '../components/SiteHeader';
import { StatsBar } from '../components/StatsBar';
import { TransferPanel } from '../components/TransferPanel';

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <StatsBar />
        <HowItWorks />
        <TransferPanel />
        <RedeemPanel />
        <EarnPanel />
        <OpenSource />
        <Security />
      </main>
      <Footer />
    </>
  );
}
