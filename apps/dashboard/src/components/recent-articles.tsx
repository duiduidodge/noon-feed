'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';

interface Article {
  id: string;
  titleOriginal: string;
  publishedAt: Date | null;
  url: string;
  originalSourceName: string | null;
  source: { name: string };
  enrichment: {
    titleTh: string | null;
    tags: unknown;
    sentiment: string;
    marketImpact: string;
  } | null;
}

interface RecentArticlesProps {
  articles: Article[];
}

const sentimentColors: Record<string, string> = {
  BULLISH: 'bg-emerald-100 text-emerald-800',
  BEARISH: 'bg-rose-100 text-rose-800',
  NEUTRAL: 'bg-slate-100 text-slate-700',
};

const impactColors: Record<string, string> = {
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  LOW: 'bg-sky-100 text-sky-800',
};

export function RecentArticles({ articles }: RecentArticlesProps) {
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');

  const sortedArticles = useMemo(() => {
    return [...articles].sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return sort === 'newest' ? bTime - aTime : aTime - bTime;
    });
  }, [articles, sort]);

  if (articles.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">No articles yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-medium">Latest enriched articles</p>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as 'newest' | 'oldest')}
          className="rounded-md border bg-background px-2 py-1 text-xs"
          aria-label="Sort recent articles"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead className="sticky top-0 border-b bg-muted/60">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Article</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Source</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Sentiment</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Impact</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Published</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedArticles.map((article) => (
              <tr key={article.id} className="hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="max-w-md">
                    <Link
                      href={`/articles/${article.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {article.enrichment?.titleTh || article.titleOriginal}
                    </Link>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {article.titleOriginal}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  {article.originalSourceName || article.source.name}
                </td>
                <td className="px-4 py-3">
                  {article.enrichment && (
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        sentimentColors[article.enrichment.sentiment]
                      }`}
                    >
                      {article.enrichment.sentiment}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {article.enrichment && (
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        impactColors[article.enrichment.marketImpact]
                      }`}
                    >
                      {article.enrichment.marketImpact}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {article.publishedAt
                    ? format(new Date(article.publishedAt), 'MMM d, HH:mm')
                    : '-'}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {sortedArticles.map((article) => (
          <article key={article.id} className="rounded-lg border bg-background p-3">
            <Link href={`/articles/${article.id}`} className="font-medium hover:text-primary">
              {article.enrichment?.titleTh || article.titleOriginal}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              {article.originalSourceName || article.source.name}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {article.enrichment && (
                <>
                  <span className={`rounded-full px-2 py-1 text-[11px] ${sentimentColors[article.enrichment.sentiment]}`}>
                    {article.enrichment.sentiment}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-[11px] ${impactColors[article.enrichment.marketImpact]}`}>
                    {article.enrichment.marketImpact}
                  </span>
                </>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {article.publishedAt
                  ? format(new Date(article.publishedAt), 'MMM d, HH:mm')
                  : '-'}
              </span>
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-primary">
                Open source
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
