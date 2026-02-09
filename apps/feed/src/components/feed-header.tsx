import { MarketTicker } from './market-ticker';

export function FeedHeader() {
  return (
    <header className="sticky top-0 z-50">
      <div className="glass border-b border-border/30">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          {/* Logo — bold typographic treatment */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 border border-accent/30">
              <span className="font-display text-xs font-bold text-accent">C</span>
            </div>
            <span className="font-display text-base font-bold tracking-tight text-foreground">
              Crypto<span className="text-accent">Feed</span>
            </span>
          </div>

          {/* Market ticker — center */}
          <div className="hidden md:block">
            <MarketTicker />
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <span className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">
              Live
            </span>
            <div className="h-2 w-2 rounded-full bg-accent animate-dot-pulse" />
          </div>
        </div>

        {/* Mobile ticker */}
        <div className="border-t border-border/30 px-4 py-2 md:hidden">
          <MarketTicker />
        </div>
      </div>

      {/* Animated gradient line */}
      <div className="gradient-line" />
    </header>
  );
}
