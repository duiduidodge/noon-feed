'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { NewsCard, type FeedArticle } from './news-card';
import { TagFilter } from './tag-filter';

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
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loadedPages, setLoadedPages] = useState<FeedArticle[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['feed-articles', selectedTag],
    queryFn: () => fetchArticles(selectedTag, null),
    refetchInterval: 2 * 60 * 1000,
  });

  const handleTagSelect = (tag: string | null) => {
    setSelectedTag(tag);
    setLoadedPages([]);
    setHasMore(true);
    setLoadMoreError(null);
  };

  const handleLoadMore = async () => {
    const lastArticle = allArticles[allArticles.length - 1];
    if (!lastArticle || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await fetchArticles(selectedTag, lastArticle.id);
      setLoadedPages((prev) => [...prev, ...result.articles]);
      setHasMore(result.hasMore);
    } catch (error) {
      setLoadMoreError('Could not load more articles. Please try again.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const baseArticles =
    !selectedTag && !data ? initialArticles : data?.articles || [];
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
  }, [hasMore, isLoadingMore, allArticles.length, selectedTag]);

  return (
    <div className="flex h-full min-h-0 flex-col space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <h2 className="font-display text-sm font-semibold tracking-wide text-foreground">
          Latest Intel
        </h2>
        <div className="text-right">
          <div className="font-mono-data text-[11px] text-muted-foreground/70">
            {allArticles.length} articles
          </div>
          {dataUpdatedAt > 0 && (
            <div className="font-mono-data text-[10px] text-muted-foreground/45">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      <TagFilter selectedTag={selectedTag} onTagSelect={handleTagSelect} />
      {selectedTag && (
        <div className="border-b border-border/30 px-4 py-2">
          <button
            onClick={() => handleTagSelect(null)}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-mono-data text-[11px] font-medium uppercase tracking-wide text-accent"
          >
            <X className="h-3 w-3" />
            {selectedTag}
          </button>
        </div>
      )}

      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        {isLoading && selectedTag ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-accent/50" />
          </div>
        ) : error ? (
          <div className="px-4 py-10 text-center">
            <p className="font-mono-data text-xs uppercase tracking-wider text-bearish">
              Feed unavailable
            </p>
          </div>
        ) : allArticles.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="font-mono-data text-xs text-muted-foreground/50 uppercase tracking-wider">
              No intel found
            </p>
          </div>
        ) : (
          <>
            {allArticles.map((article, i) => (
              <NewsCard key={article.id} article={article} index={i} />
            ))}

            {hasMore && allArticles.length > 0 && (
              <div className="p-4">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full rounded-md border border-accent/20 bg-transparent py-2.5 font-mono-data text-[11px] font-medium uppercase tracking-wider text-accent/70 transition-all duration-200 hover:border-accent/40 hover:text-accent hover:shadow-[0_0_12px_hsl(var(--accent)/0.1)] disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    'Load More'
                  )}
                </button>
                {isLoadingMore && (
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-16 animate-shimmer rounded-md border border-border/30"
                      />
                    ))}
                  </div>
                )}
                {loadMoreError && (
                  <p className="mt-2 text-center text-xs text-bearish">{loadMoreError}</p>
                )}
              </div>
            )}
            <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
            {!hasMore && allArticles.length > 0 && (
              <div className="p-4 text-center">
                <p className="font-mono-data text-[11px] uppercase tracking-wider text-muted-foreground/55">
                  You are caught up
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
