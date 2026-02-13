import { BiDailySummary } from '@/components/bi-daily-summary';

export default function BriefingPage() {
    return (
        <main className="mx-auto flex w-full max-w-[1780px] flex-1 flex-col px-4 py-6 lg:px-5">
            <div className="mx-auto w-full max-w-4xl space-y-6">
                <h1 className="font-display text-4xl font-bold tracking-tight text-foreground/90">Evening Briefing</h1>
                <p className="max-w-xl text-muted-foreground">
                    Comprehensive market analysis and key narratives summarizing the crypto landscape.
                </p>

                <div className="mt-8 overflow-hidden rounded-2xl border border-border/60 bg-card/50 shadow-sm column-panel p-6">
                    <BiDailySummary />
                </div>
            </div>
        </main>
    );
}
