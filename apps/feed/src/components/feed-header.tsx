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

  const handleNavClick = useCallback((item: typeof NAV_ITEMS[0]) => {
    if (!item.sectionId && !item.path) return;

    // Optimistic UI update
    setActiveTab(item.label);

    // If we are on the homepage, scrolling is preferred for sections that exist there
    if (pathname === '/') {
      const el = document.getElementById(item.sectionId || '');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        el.classList.add('section-highlight');
        setTimeout(() => el.classList.remove('section-highlight'), 1200);
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
      <div className="bg-background/90 backdrop-blur-md border-b border-border/40">
        <div className="mx-auto flex h-16 max-w-[1780px] items-center justify-between px-4 lg:px-5">
          {/* Logo — noon PNG, significantly bigger */}
          <div className="flex items-center cursor-pointer" onClick={() => router.push('/')}>
            <Image
              src="/noon-logo.png"
              alt="noon"
              width={140}
              height={40}
              className="h-8 w-auto logo-light select-none"
              priority
            />
          </div>

          {/* Navigation tabs — center */}
          <nav className="hidden md:flex items-center gap-1" role="navigation" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item)}
                className={`
                  px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 relative
                  ${activeTab === item.label
                    ? 'bg-primary/12 text-primary border border-primary/25 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface/60'
                  }
                  ${!item.sectionId ? 'opacity-50 cursor-not-allowed pr-5' : 'cursor-pointer'}
                `}
                title={!item.sectionId ? 'Coming soon' : undefined}
              >
                {item.label}
                {!item.sectionId && (
                  <span className="absolute -top-2 -right-2.5 text-[7px] font-mono-data bg-surface/80 border border-border/40 text-muted-foreground/70 uppercase px-1 py-px rounded-sm leading-none">
                    soon
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Right controls: search + theme toggle + menu */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface/50 transition-colors"
              aria-label="Search articles"
            >
              <Search className="h-5 w-5" />
            </button>
            <ThemeToggle />
            <button
              className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface/50 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Market ticker strip */}
      <div className="border-b border-border/30 bg-surface/40 overflow-hidden">
        <MarketTicker />
      </div>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
}
