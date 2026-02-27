'use client';

import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetupItem {
  id: string;
  asset: string;
  direction: string;
  confidence: number;
  thesis: string;
}

interface SetupResponse {
  generatedAt: string;
  whaleTopScore: number | null;
  setups: SetupItem[];
}

async function fetchSetups(): Promise<SetupResponse> {
  const res = await fetch('/api/signals/setups');
  if (!res.ok) throw new Error('Failed to fetch setups');
  return res.json();
}

export function TradeSetupsPanel() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['trade-setups'],
    queryFn: fetchSetups,
    refetchInterval: 60_000,
  });

  const setups = data?.setups || [];

  return (
    <section className="rounded-2xl border border-border/35 bg-card/72 backdrop-blur-sm overflow-hidden panel-secondary">
      <div className="flex items-center gap-2 border-b border-border/30 bg-surface/18 px-unit-3 py-unit-3">
        <Sparkles className="w-3.5 h-3.5 text-primary/80" aria-hidden="true" />
        <span className="text-label font-semibold uppercase tracking-[0.14em] text-foreground/85 font-mono-data">
          Trade Setups
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-border/40 to-transparent" aria-hidden="true" />
        {data?.generatedAt ? (
          <span className="text-micro font-mono-data text-muted-foreground/65 uppercase tracking-wider">
            {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : null}
      </div>

      <div className="px-unit-3 py-unit-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-12 rounded-lg border border-border/25 bg-card/35 animate-shimmer" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-bearish/35 bg-bearish/8 px-3 py-2 text-caption text-bearish">
            Setup engine unavailable.
          </div>
        ) : setups.length === 0 ? (
          <div className="rounded-lg border border-border/30 bg-card/35 px-3 py-2 text-caption text-muted-foreground/75">
            No high-confidence setups yet.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {setups.slice(0, 4).map((item) => (
              <a
                key={item.id}
                href="https://app.hyperliquid.xyz/trade"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 rounded-lg border border-border/35 bg-card/45 px-2.5 py-2 transition-all duration-fast hover:border-primary/35 hover:bg-surface/65"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-data text-caption font-bold text-foreground/90 truncate">
                      {item.asset} {item.direction}
                    </span>
                    <span
                      className={cn(
                        'rounded border px-1.5 py-0.5 font-mono-data text-micro font-bold uppercase tracking-wider',
                        item.confidence >= 80
                          ? 'border-bullish/45 bg-bullish/12 text-bullish'
                          : 'border-primary/35 bg-primary/10 text-primary'
                      )}
                    >
                      {item.confidence}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono-data text-micro text-muted-foreground/70 truncate">
                    {item.thesis}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
