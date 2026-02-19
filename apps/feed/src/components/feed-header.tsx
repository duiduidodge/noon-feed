'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { MarketTicker } from './market-ticker';
import { ThemeToggle } from './theme-toggle';
import { Search } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import SearchModal from './SearchModal';

const NAV_ITEMS = [
  { label: 'Latest Intel', sectionId: 'section-latest-intel', path: '/' },
  { label: 'Briefing', sectionId: 'section-briefing', path: '/briefing' },
  { label: 'Posts', sectionId: 'section-posts', path: '/posts' },
  { label: 'Alpha', sectionId: null, path: null },
  { label: 'Markets', sectionId: 'section-markets', path: '/markets' },
];

export function FeedHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Latest Intel');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Sync active tab with pathname on mount/change
  useEffect(() => {
    if (pathname === '/') {
      setActiveTab('Latest Intel');
    } else if (pathname.includes('/briefing')) {
      setActiveTab('Briefing');
    } else if (pathname.includes('/posts')) {
      setActiveTab('Posts');
    } else if (pathname.includes('/markets')) {
      setActiveTab('Markets');
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

  const handleNavClick = useCallback((item: typeof NAV_ITEMS[0]) => {
    setIsMenuOpen(false); // Close menu on navigation

    if (!item.sectionId && !item.path) return;

    // Optimistic UI update
    setActiveTab(item.label);

    // If we are on the homepage, scrolling is preferred for sections that exist there
    if (pathname === '/') {
      const el = document.getElementById(item.sectionId || '');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        // Optional: Trigger a highlight animation
        return;
      }
    }

    // If we are navigating to a dedicated page (or from a dedicated page back to home)
    if (item.path) {
      router.push(item.path);
    }
  }, [pathname, router]);

  return (
    <header className="sticky top-0 z-50">
      {/* Main navigation bar */}
      <div className="bg-background/90 backdrop-blur-xl border-b border-border/45 transition-all duration-300 relative z-50">
        <div className="mx-auto flex h-[64px] md:h-[72px] max-w-[1640px] items-center justify-between px-3 md:px-4 lg:px-6">
          {/* Logo — noon PNG */}
          <div className="flex items-center cursor-pointer opacity-90 hover:opacity-100 transition-opacity" onClick={() => router.push('/')}>
            <Image
              src="/noon-logo.png"
              alt="noon"
              width={160}
              height={46}
              className="h-8 md:h-9 w-auto logo-light select-none"
              priority
            />
          </div>

          {/* Navigation tabs — center */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-7" role="navigation" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item)}
                  disabled={!item.sectionId}
                  className={`
                    relative py-2 text-[14px] font-medium tracking-tight transition-all duration-200
                    ${isActive
                      ? 'text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground/85'
                    }
                    ${!item.sectionId ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {item.label}
                    {!item.sectionId && !item.path && (
                      <span className="rounded-full border border-border/60 bg-card/70 px-1.5 py-0.5 font-mono-data text-[8px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                        Soon
                      </span>
                    )}
                  </span>

                  {/* Active Indicator */}
                  {isActive && (
                    <span className="absolute -bottom-[22px] left-0 right-0 h-[2px] bg-primary dark:shadow-none shadow-[0_-2px_8px_hsl(var(--primary)/0.4)] rounded-t-full scale-x-100 transition-transform duration-300" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right controls: search + theme toggle + menu */}
          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="group flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface/50 transition-all duration-200 md:h-10 md:w-10"
              aria-label="Search articles"
            >
              <Search className="h-[17px] w-[17px] text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

            <div className="h-4 w-px bg-border/40 mx-1" />

            <ThemeToggle />

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="group relative z-50 flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface/50 transition-all duration-200 md:h-10 md:w-10"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
            >
              <div className="flex flex-col gap-[5px] w-[18px]">
                <span className={`block w-full h-[1.5px] bg-foreground/80 transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-[6.5px]' : ''}`} />
                <span className={`block w-full h-[1.5px] bg-foreground/80 transition-all duration-300 ${isMenuOpen ? 'opacity-0 scale-x-0' : ''}`} />
                <span className={`block w-full h-[1.5px] bg-foreground/80 transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-[6.5px]' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-background/95 backdrop-blur-xl transition-all duration-500 md:hidden ${isMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
          }`}
      >
        <div className={`flex flex-col h-full pt-[80px] px-6 pb-10 transition-all duration-500 delay-100 ${isMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item, idx) => {
              const isActive = activeTab === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item)}
                  disabled={!item.sectionId}
                  className={`
                     group flex items-center justify-between py-5 border-b border-border/20 text-left
                     ${!item.sectionId ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                   `}
                  style={{ transitionDelay: `${150 + idx * 50}ms` }}
                >
                  <span className={`text-2xl font-display font-bold tracking-tight transition-colors ${isActive ? 'text-primary' : 'text-foreground group-hover:text-primary/70'}`}>
                    {item.label}
                  </span>
                  {isActive && <div className="h-2 w-2 rounded-full bg-primary dark:shadow-none shadow-[0_0_10px_hsl(var(--primary))]" />}
                  {!item.sectionId && (
                    <span className="px-2 py-0.5 rounded-full bg-surface text-[10px] font-mono-data uppercase tracking-wider text-muted-foreground">
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-auto">
            <div className="p-5 rounded-2xl bg-surface/50 border border-border/30 backdrop-blur-sm">
              <h4 className="font-mono-data text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Market Status</h4>
              <MarketTicker />
            </div>
          </div>
        </div>
      </div>

      {/* Market ticker strip (Desktop) */}
      <div className="relative hidden h-[36px] items-center overflow-hidden border-b border-border/30 bg-background/70 backdrop-blur-md md:flex">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background via-background/80 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background via-background/80 to-transparent z-10" />
        <MarketTicker />
      </div>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
}
