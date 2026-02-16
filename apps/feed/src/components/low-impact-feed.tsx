'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Radio } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';
import { type FeedArticle } from './news-card';

async function fetchLowImpactNews() {
    const res = await fetch('/api/articles?impact=LOW&limit=15');
    if (!res.ok) throw new Error('Failed to fetch filtered news');
    return res.json() as Promise<{ articles: FeedArticle[] }>;
}

export function LowImpactFeed() {
    const { data, isLoading } = useQuery({
        queryKey: ['low-impact-news'],
        queryFn: fetchLowImpactNews,
        refetchInterval: 30000,
    });

    if (isLoading) {
        return (
            <div className="mt-6 flex justify-center py-8 opacity-50">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const articles = data?.articles || [];
    const isEmpty = articles.length === 0;

    return (
        <div className="mt-8 flex flex-col gap-4">
            <div className="flex items-center gap-2 px-1">
                <Radio className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                <h3 className="font-mono-data text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Market Chatter
                </h3>
            </div>

            {isEmpty ? (
                <div className="rounded-xl border border-border/40 bg-card/30 p-4 text-center backdrop-blur-sm">
                    <p className="font-mono-data text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                        No active chatter
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-px rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden">
                    {articles.map((article) => (
                        <a
                            key={article.id}
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative flex flex-col gap-1.5 border-b border-border/20 bg-transparent p-3 transition-colors hover:bg-surface/50 last:border-0"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-mono-data text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70 group-hover:text-primary/80 transition-colors">
                                    {article.sourceName}
                                </span>
                                <span className="font-mono-data text-[9px] text-muted-foreground/50 tabular-nums">
                                    {article.publishedAt ? formatDistanceToNowStrict(new Date(article.publishedAt), { addSuffix: true }) : ''}
                                </span>
                            </div>

                            <h4 className="font-sans text-[11px] leading-snug text-foreground/80 group-hover:text-foreground transition-colors line-clamp-2">
                                {article.title}
                            </h4>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
