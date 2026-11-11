import { AppleMark } from './AppleMark';
import { ThemeToggle } from './ThemeToggle';
import { WalletButton } from './WalletButton';

const NAV = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#transfer', label: 'Send' },
  { href: '#earn', label: 'Earn' },
  { href: '#open-source', label: 'Open source' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          <AppleMark className="h-7 w-6" label="Privacy Stock" />
          <span className="font-display text-lg font-semibold tracking-tight">privacy stock</span>
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="nav-link">{item.label}</a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <WalletButton />
        </div>
      </div>

      <nav aria-label="Sections" className="flex gap-1 overflow-x-auto border-t border-line px-4 py-2 md:hidden">
        {NAV.map((item) => (
          <a key={item.href} href={item.href} className="nav-link whitespace-nowrap">{item.label}</a>
        ))}
      </nav>
    </header>
  );
}
