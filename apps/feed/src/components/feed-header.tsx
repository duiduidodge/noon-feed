'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { MarketTicker } from './market-ticker';
import { ThemeToggle } from './theme-toggle';
import { Menu, Search } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import SearchModal from './SearchModal';

const NAV_ITEMS = [
  { label: 'Latest Intel', sectionId: 'section-latest-intel', path: '/' },
  { label: 'Briefing', sectionId: 'section-briefing', path: '/briefing' },
  { label: 'Posts', sectionId: 'section-posts', path: '/posts' },
  { label: 'Markets', sectionId: 'section-markets', path: '/markets' },
  { label: 'Data', sectionId: null, path: null }, // Future feature
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
      <div className="bg-background/80 backdrop-blur-xl border-b border-border/40 transition-all duration-300 relative z-50">
        <div className="mx-auto flex h-[72px] max-w-[1780px] items-center justify-between px-4 lg:px-6">
          {/* Logo — noon PNG */}
          <div className="flex items-center cursor-pointer opacity-90 hover:opacity-100 transition-opacity" onClick={() => router.push('/')}>
            <Image
              src="/noon-logo.png"
              alt="noon"
              width={160}
              height={46}
              className="h-9 w-auto logo-light select-none"
              priority
            />
          </div>

          {/* Navigation tabs — center */}
          <nav className="hidden md:flex items-center gap-6" role="navigation" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item)}
                  disabled={!item.sectionId}
                  className={`
                    relative py-2 text-[13px] font-medium tracking-wide transition-all duration-200
                    ${isActive
                      ? 'text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground/80'
                    }
                    ${!item.sectionId ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {item.label}

                  {/* Active Indicator */}
                  {isActive && (
                    <span className="absolute -bottom-[25px] left-0 right-0 h-[2px] bg-primary shadow-[0_-2px_8px_hsl(var(--primary)/0.4)] rounded-t-full scale-x-100 transition-transform duration-300" />
                  )}

                  {/* 'Soon' Badge */}
                  {!item.sectionId && (
                    <span className="absolute -top-3 -right-3 text-[9px] font-mono-data text-muted-foreground/50 uppercase tracking-tighter">
                      SOON
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right controls: search + theme toggle + menu */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="group flex items-center justify-center h-10 w-10 rounded-full hover:bg-surface/50 transition-all duration-200"
              aria-label="Search articles"
            >
              <Search className="h-[18px] w-[18px] text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

            <div className="h-4 w-px bg-border/40 mx-1" />

            <ThemeToggle />

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="group flex items-center justify-center h-10 w-10 rounded-full hover:bg-surface/50 transition-all duration-200 relative z-50"
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
                  {isActive && <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />}
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
      <div className="border-b border-border/30 bg-background/40 backdrop-blur-md overflow-hidden h-[34px] flex items-center">
        <MarketTicker />
      </div>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
}
