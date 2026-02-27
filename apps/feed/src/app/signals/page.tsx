'use client';

import { useQuery } from '@tanstack/react-query';
import { SignalPulseHeader } from '@/components/signals/signal-pulse-header';
import { OpportunitySection } from '@/components/signals/opportunity-section';
import { EmergingSection } from '@/components/signals/emerging-section';
import { WhaleSection } from '@/components/signals/whale-section';

async function fetchDeepSignals() {
  const res = await fetch('/api/signals/deep');
  if (!res.ok) throw new Error('Failed to fetch deep signals');
  return res.json();
}

export default function SignalsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['deep-signals'],
    queryFn: fetchDeepSignals,
    refetchInterval: 60_000,
  });

  const opp = data?.opportunities;
  const emg = data?.emerging;
  const whl = data?.whales;

  return (
    <div className="min-h-[100dvh] bg-background">
      <main className="mx-auto max-w-[1280px] px-4 py-4 md:px-6 md:py-6 space-y-6">

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-6">
            <div className="h-14 rounded-xl border border-border/30 bg-surface/20 animate-shimmer" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-5 w-48 rounded bg-surface/30 animate-shimmer" />
                <div className="grid grid-cols-[200px_1fr] gap-4">
                  <div className="h-40 rounded-xl border border-border/25 bg-surface/15 animate-shimmer" />
                  <div className="space-y-2">
                    <div className="h-32 rounded-xl border border-border/25 bg-surface/15 animate-shimmer" />
                    <div className="h-32 rounded-xl border border-border/25 bg-surface/15 animate-shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="rounded-xl border border-bearish/30 bg-bearish/8 px-6 py-8 text-center">
            <p className="font-mono-data text-caption text-bearish uppercase tracking-wider">
              Signal feed unavailable. Check connection and retry.
            </p>
          </div>
        )}

        {/* Data loaded */}
        {data && !isLoading && (
          <>
            {/* Header pulse bar */}
            <SignalPulseHeader
              oppScanTime={opp?.snapshot?.scanTime ?? null}
              emergingScanTime={emg?.snapshot?.signalTime ?? null}
              whaleScanTime={whl?.snapshot?.scanTime ?? null}
              btcContext={opp?.snapshot?.btcContext ?? null}
              oppCount={opp?.items?.length ?? 0}
              emergingCount={emg?.alerts?.length ?? 0}
              whaleCount={whl?.traders?.length ?? 0}
              hasImmediate={emg?.snapshot?.hasImmediate ?? false}
            />

            {/* Section dividers with generous spacing */}
            <div className="space-y-8">
              <OpportunitySection
                snapshot={opp?.snapshot ?? null}
                items={opp?.items ?? []}
              />

              <div className="h-px bg-gradient-to-r from-transparent via-border/30 to-transparent" aria-hidden="true" />

              <EmergingSection
                snapshot={emg?.snapshot ?? null}
                alerts={emg?.alerts ?? []}
              />

              <div className="h-px bg-gradient-to-r from-transparent via-border/30 to-transparent" aria-hidden="true" />

              <WhaleSection
                snapshot={whl?.snapshot ?? null}
                traders={whl?.traders ?? []}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
