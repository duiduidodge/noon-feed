'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { MarketTicker } from './market-ticker';
import { ThemeToggle } from './theme-toggle';
import { Search } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import SearchModal from './SearchModal';

const NAV_ITEMS = [
  { label: 'Hub', path: '/' },
  { label: 'Feed', path: '/feed' },
  { label: 'Signals', path: '/signals' },
  { label: 'Briefing', path: '/briefing' },
  { label: 'Markets', path: '/markets' },
  { label: 'Charts', path: '/charts' },
  { label: 'Posts', path: '/posts' },
];

export function FeedHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Hub');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Sync active tab with pathname on mount/change
  useEffect(() => {
    if (pathname === '/') {
      setActiveTab('Hub');
    } else if (pathname.startsWith('/feed')) {
      setActiveTab('Feed');
    } else if (pathname.includes('/briefing')) {
      setActiveTab('Briefing');
    } else if (pathname.includes('/markets')) {
      setActiveTab('Markets');
    } else if (pathname.includes('/charts')) {
      setActiveTab('Charts');
    } else if (pathname.includes('/posts')) {
      setActiveTab('Posts');
    } else if (pathname.includes('/signals')) {
      setActiveTab('Signals');
    }
  }, [pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavClick = useCallback((item: typeof NAV_ITEMS[0]) => {
    setIsMenuOpen(false);

    setActiveTab(item.label);

    router.push(item.path);
  }, [router]);

  return (
    <header className="sticky top-0 z-50">
      {/* Main navigation bar */}
      <div className="relative z-50 border-b border-border/55 bg-[hsl(var(--background)/0.97)] backdrop-blur-xl transition-all duration-normal">
        <div className="mx-auto grid h-[74px] max-w-[1680px] grid-cols-[auto_1fr_auto] items-center gap-4 px-3 md:h-[88px] md:px-5 lg:px-6">
          {/* Logo */}
          <div
            className="flex items-center cursor-pointer rounded-full border border-border/70 bg-[hsl(var(--card)/0.94)] px-3.5 py-2.5 opacity-100 shadow-card transition-all duration-fast hover:border-primary/30 hover:bg-[hsl(var(--card)/0.98)]"
            onClick={() => router.push('/')}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') router.push('/'); }}
          >
            <Image
              src="/noon-logo.png"
              alt="noon — Crypto Intelligence"
              width={160}
              height={46}
              className="h-8 w-auto select-none logo-light md:h-9"
              priority
            />
          </div>

          {/* Navigation tabs — center */}
          <nav
            className="hidden min-w-0 items-center justify-center md:flex"
            role="tablist"
            aria-label="Main navigation"
          >
            <div className="flex items-center gap-2 rounded-full border border-border/70 bg-[hsl(var(--card)/0.92)] px-2.5 py-2 shadow-card">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item)}
                  role="tab"
                  aria-selected={isActive}
                  className={`
                    relative rounded-full px-3.5 py-2.5 font-mono-data text-[12px] font-bold uppercase tracking-[0.12em] transition-colors duration-fast
                    ${isActive
                      ? 'text-primary-foreground'
                      : 'text-foreground/82 hover:bg-[hsl(var(--surface)/0.88)] hover:text-foreground'
                    }
                    cursor-pointer focus-ring
                  `}
                >
                  <span className="relative z-10 inline-flex items-center gap-1.5">{item.label}</span>

                  {/* Animated active indicator */}
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-indicator"
                      className="absolute inset-0 rounded-full bg-[hsl(var(--primary)/0.92)]"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
            </div>
          </nav>

          {/* Right controls */}
          <div className="flex items-center justify-end gap-2 md:gap-2.5">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="group flex h-11 items-center justify-center gap-2 rounded-full border border-border/70 bg-[hsl(var(--card)/0.94)] px-3.5 shadow-card transition-colors duration-fast hover:border-primary/30 hover:bg-[hsl(var(--card)/0.98)] md:h-11 focus-ring"
              aria-label="Search articles (Cmd+K)"
            >
              <Search className="h-[17px] w-[17px] text-muted-foreground group-hover:text-primary transition-colors duration-fast" />
              <span className="hidden font-mono-data text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/86 md:inline">Search</span>
              <span className="hidden rounded-full border border-border/60 bg-background/55 px-2 py-0.5 font-mono-data text-[9px] font-bold text-foreground/56 md:inline">CMD+K</span>
            </button>

            <div className="mx-1 h-4 w-px bg-border/50" aria-hidden="true" />

            <ThemeToggle />

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="group relative z-50 flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-[hsl(var(--card)/0.94)] shadow-card transition-colors duration-fast hover:border-primary/30 hover:bg-[hsl(var(--card)/0.98)] md:h-11 md:w-11 focus-ring"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
            >
              <div className="flex flex-col gap-[5px] w-[18px]" aria-hidden="true">
                <span className={`block w-full h-[1.5px] bg-foreground/80 transition-all duration-normal ${isMenuOpen ? 'rotate-45 translate-y-[6.5px]' : ''}`} />
                <span className={`block w-full h-[1.5px] bg-foreground/80 transition-all duration-normal ${isMenuOpen ? 'opacity-0 scale-x-0' : ''}`} />
                <span className={`block w-full h-[1.5px] bg-foreground/80 transition-all duration-normal ${isMenuOpen ? '-rotate-45 -translate-y-[6.5px]' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-background/95 backdrop-blur-xl transition-all duration-slow md:hidden ${isMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
          }`}
        role="dialog"
        aria-modal={isMenuOpen}
        aria-label="Navigation menu"
      >
        <div className={`flex min-h-[100dvh] flex-col overflow-y-auto pt-20 px-6 pb-10 transition-all duration-slow delay-100 ${isMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <div className="flex flex-col gap-1" role="tablist">
            {NAV_ITEMS.map((item, idx) => {
              const isActive = activeTab === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item)}
                  role="tab"
                  aria-selected={isActive}
                  className={`
                     group flex items-center justify-between py-5 border-b border-border/20 text-left focus-ring
                     cursor-pointer
                   `}
                  style={{ transitionDelay: `${150 + idx * 50}ms` }}
                >
                  <span className={`text-2xl font-display font-bold tracking-tight transition-colors duration-fast ${isActive ? 'text-primary' : 'text-foreground group-hover:text-primary/70'}`}>
                    {item.label}
                  </span>
                  {isActive && <div className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <div className="mt-auto">
            <div className="p-5 rounded-2xl bg-surface/50 border border-border/30 backdrop-blur-sm">
              <h4 className="font-mono-data text-caption uppercase tracking-widest text-muted-foreground mb-3">Market Status</h4>
              <MarketTicker marquee={false} compact />
            </div>
          </div>
        </div>
      </div>

      {/* Market ticker strip (Desktop) */}
      <div className="border-b border-border/40 bg-[hsl(var(--background)/0.9)] backdrop-blur-md">
        <div className="ticker-pause relative mx-auto hidden h-[38px] max-w-[1680px] items-center overflow-hidden px-3 md:flex md:px-5 lg:px-6" role="marquee" aria-label="Market prices ticker">
          <div className="pointer-events-none absolute inset-y-0 left-3 z-10 w-12 bg-gradient-to-r from-background via-background/92 to-transparent md:left-5 lg:left-6" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-y-0 right-3 z-10 w-12 bg-gradient-to-l from-background via-background/92 to-transparent md:right-5 lg:right-6" aria-hidden="true" />
          <div className="w-full overflow-hidden rounded-full border border-border/60 bg-[hsl(var(--card)/0.88)] px-3 shadow-card">
            <MarketTicker />
          </div>
        </div>
      </div>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
}
