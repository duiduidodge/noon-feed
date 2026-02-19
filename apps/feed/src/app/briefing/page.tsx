import { BiDailySummary } from '@/components/bi-daily-summary';

export default function BriefingPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1640px] flex-1 flex-col px-3 py-5 md:px-4 lg:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3 py-1 font-mono-data text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Briefing
        </span>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground/95 md:text-5xl">Evening Briefing</h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          Comprehensive market analysis and key narratives summarizing the crypto landscape.
        </p>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/75 shadow-sm column-panel p-4 md:p-6">
          <BiDailySummary />
        </div>
      </div>
    </main>
  );
}
