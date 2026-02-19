'use client';

import { useQuery } from '@tanstack/react-query';
import { Radio } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { type FeedArticle } from './news-card';

async function fetchLowImpactNews(limit: number) {
    const res = await fetch(`/api/articles?impact=LOW&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch filtered news');
    return res.json() as Promise<{ articles: FeedArticle[] }>;
}

interface LowImpactFeedProps {
    /** When true: removes top margin and internal header (used when rendered inside MarketChatterPanel) */
    standalone?: boolean;
    limit?: number;
}

export function LowImpactFeed({ standalone = false, limit = 12 }: LowImpactFeedProps) {
    const [expanded, setExpanded] = useState(false);
    const { data, isLoading } = useQuery({
        queryKey: ['low-impact-news', limit],
        queryFn: () => fetchLowImpactNews(limit),
        refetchInterval: 30000,
    });

    if (isLoading) {
        return (
            <div className={cn(standalone ? 'py-2' : 'mt-4 py-2', 'space-y-2')}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-border/25 bg-card/35 p-3">
                        <div className="mb-2 h-3 w-20 animate-shimmer rounded" />
                        <div className="h-3 w-[92%] animate-shimmer rounded" />
                    </div>
                ))}
            </div>
        );
    }

    const articles = data?.articles || [];
    const isEmpty = articles.length === 0;
    const collapsedCount = standalone ? 7 : 10;
    const visibleArticles = standalone && !expanded ? articles.slice(0, collapsedCount) : articles;

    return (
        <div className={cn('flex flex-col gap-4', !standalone && 'mt-8')}>
            {!standalone && (
                <div className="flex items-center gap-2 px-1">
                    <Radio className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                    <h3 className="font-mono-data text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Market Chatter
                    </h3>
                </div>
            )}

            {isEmpty ? (
                <div className="rounded-xl border border-border/40 bg-card/30 p-4 text-center backdrop-blur-sm">
                    <p className="font-mono-data text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                        No active chatter
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-2 p-1">
                    {visibleArticles.map((article) => (
                        <a
                            key={article.id}
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative flex gap-3 rounded-lg border border-border/35 bg-card/45 p-3 transition-all hover:bg-surface/65 hover:border-border/65"
                        >
                            {/* Avatar / Icon Placeholder */}
                            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-surface border border-border/50 flex items-center justify-center">
                                <span className="font-mono-data text-[10px] font-semibold text-muted-foreground/80 group-hover:text-foreground">
                                    {article.sourceName.substring(0, 2).toUpperCase()}
                                </span>
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="font-mono-data text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/85 group-hover:text-primary transition-colors">
                                        {article.sourceName}
                                    </span>
                                    <span className="font-mono-data text-[9px] text-muted-foreground/60 tabular-nums whitespace-nowrap">
                                        {article.publishedAt ? formatDistanceToNowStrict(new Date(article.publishedAt), { addSuffix: true }) : ''}
                                    </span>
                                </div>

                                <h4 className="font-sans text-[12.5px] leading-snug text-foreground/90 group-hover:text-foreground transition-colors line-clamp-2">
                                    {article.title}
                                </h4>
                            </div>
                        </a>
                    ))}
                </div>
            )}
            {standalone && articles.length > collapsedCount && (
                <button
                    type="button"
                    onClick={() => setExpanded((prev) => !prev)}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-border/55 bg-card/65 px-3 font-mono-data text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/90 transition-colors hover:border-primary/35 hover:text-primary"
                >
                    {expanded ? 'Show Less' : `View ${articles.length - collapsedCount} More`}
                </button>
            )}
        </div>
    );
}
