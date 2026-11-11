import { AppleMark } from './AppleMark';

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="mx-auto grid min-h-[78vh] max-w-6xl items-center gap-12 px-5 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="fade-up">
          <p className="eyebrow">Base mainnet · AAPLc</p>
          <h1 className="display-xl mt-6 max-w-xl">
            Send AAPLc with a one-time code.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">
            Earn a share of deposit fees.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <a href="#transfer" className="btn btn-primary btn-lg">Send AAPLc</a>
            <a href="#earn" className="btn btn-secondary btn-lg">Enter Earn</a>
          </div>

          <ul className="mt-10 flex flex-wrap gap-2 text-xs" aria-label="Status">
            <li className="chip chip-warn">Unaudited</li>
            <li className="chip">Not private</li>
            <li className="chip chip-ok"><span className="live-dot" aria-hidden="true" />Sourcify verified</li>
          </ul>
        </div>

        <div className="fade-up delay-1 relative mx-auto flex w-full max-w-md items-center justify-center">
          <div className="hero-glow absolute inset-0 -z-0 rounded-full" aria-hidden="true" />
          <AppleMark animated label="Faceted apple, the AAPLc mark" className="relative z-10 h-auto w-[78%] max-w-[360px] drop-shadow-[0_30px_40px_rgb(0_0_0_/_0.35)]" />
        </div>
      </div>
    </section>
  );
}
