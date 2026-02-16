'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { NewsCard, type FeedArticle } from './news-card';

interface NewsFeedProps {
  initialArticles: FeedArticle[];
}

async function fetchArticles(tag: string | null, cursor: string | null) {
  const params = new URLSearchParams();
  if (tag) params.set('tag', tag);
  if (cursor) params.set('cursor', cursor);
  params.set('limit', '20');

  const res = await fetch(`/api/articles?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch articles');
  return res.json() as Promise<{
    articles: FeedArticle[];
    nextCursor: string | null;
    hasMore: boolean;
  }>;
}

export function NewsFeed({ initialArticles }: NewsFeedProps) {
  const [loadedPages, setLoadedPages] = useState<FeedArticle[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['feed-articles'],
    queryFn: () => fetchArticles(null, null),
    refetchInterval: 2 * 60 * 1000,
  });

  const handleLoadMore = async () => {
    const lastArticle = allArticles[allArticles.length - 1];
    if (!lastArticle || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await fetchArticles(null, lastArticle.id);
      setLoadedPages((prev) => [...prev, ...result.articles]);
      setHasMore(result.hasMore);
    } catch (error) {
      setLoadMoreError('Could not load more articles. Please try again.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const baseArticles = !data ? initialArticles : data?.articles || [];
  const allArticles = [...baseArticles, ...loadedPages];

  useEffect(() => {
    const root = scrollContainerRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          void handleLoadMore();
        }
      },
      {
        root,
        rootMargin: '120px 0px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, allArticles.length]);

  return (
    <div className="flex h-full min-h-0 flex-col space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 bg-surface/20 backdrop-blur-sm sticky top-0 z-10 transition-all duration-300">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-foreground uppercase flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Latest Intel
        </h2>
        <div className="text-right">
          <div className="font-mono-data text-[11px] font-bold text-muted-foreground/80">
            {allArticles.length} <span className="text-[10px] font-normal opacity-70">ARTICLES</span>
          </div>
          {dataUpdatedAt > 0 && (
            <div className="font-mono-data text-[10px] text-muted-foreground/50">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto custom-scrollbar scroll-smooth">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
          </div>
        ) : error ? (
          <div className="px-4 py-12 text-center">
            <p className="font-mono-data text-xs uppercase tracking-wider text-bearish/80">
              Feed unavailable
            </p>
          </div>
        ) : allArticles.length === 0 ? (
          <div className="px-4 py-20 text-center">
            <p className="font-mono-data text-xs text-muted-foreground/50 uppercase tracking-wider">
              No intel found
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border/20">
              {allArticles.map((article, i) => (
                <NewsCard key={article.id} article={article} index={i} />
              ))}
            </div>

            {hasMore && allArticles.length > 0 && (
              <div className="p-6">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 py-3 font-mono-data text-[11px] font-bold uppercase tracking-widest text-primary/80 transition-all duration-300 hover:border-primary/50 hover:text-primary hover:bg-primary/10 hover:shadow-[0_0_15px_-3px_hsl(var(--primary)/0.2)] disabled:opacity-50 group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  {isLoadingMore ? (
                    <span className="inline-flex items-center gap-2 relative z-10">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    <span className="relative z-10">Load More Intel</span>
                  )}
                </button>
                {isLoadingMore && (
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-20 animate-pulse rounded-lg bg-surface/30 border border-border/20"
                      />
                    ))}
                  </div>
                )}
                {loadMoreError && (
                  <p className="mt-3 text-center font-mono-data text-[10px] text-bearish">{loadMoreError}</p>
                )}
              </div>
            )}
            <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />
            {!hasMore && allArticles.length > 0 && (
              <div className="p-8 text-center border-t border-border/20">
                <p className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
                  End of Stream
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
