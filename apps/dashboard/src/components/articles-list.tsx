'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Check, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface Article {
  id: string;
  titleOriginal: string;
  publishedAt: Date | null;
  url: string;
  status: string;
  originalSourceName: string | null;
  source: { id: string; name: string };
  enrichment: {
    titleTh: string;
    tags: unknown;
    sentiment: string;
    marketImpact: string;
  } | null;
  postings: { status: string; postedAt: Date | null }[];
}

interface ArticlesListProps {
  articles: Article[];
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
}

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  FETCHED: 'bg-sky-100 text-sky-800',
  ENRICHED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-rose-100 text-rose-800',
  SKIPPED: 'bg-slate-100 text-slate-700',
};

const sentimentStyles: Record<string, string> = {
  BULLISH: 'bg-emerald-100 text-emerald-800',
  BEARISH: 'bg-rose-100 text-rose-800',
  NEUTRAL: 'bg-slate-100 text-slate-700',
};

export function ArticlesList({
  articles,
  page,
  pageSize,
  totalPages,
  total,
}: ArticlesListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pushParams = (updater: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    updater(params);
    router.push(`/articles?${params.toString()}`);
  };

  const goToPage = (newPage: number) => {
    const safePage = Math.min(Math.max(newPage, 1), totalPages || 1);
    pushParams((params) => {
      params.set('page', safePage.toString());
    });
  };

  const updatePageSize = (newSize: number) => {
    pushParams((params) => {
      params.set('pageSize', newSize.toString());
      params.set('page', '1');
    });
  };

  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);
  const pageWindow = Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    return start + i;
  });

  if (articles.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">No articles found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead className="sticky top-0 border-b bg-muted/60 backdrop-blur">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Article</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Source</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Sentiment</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Tags</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Posted</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <div className="max-w-md">
                      <Link
                        href={`/articles/${article.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {article.enrichment?.titleTh || article.titleOriginal}
                      </Link>
                      {article.enrichment && (
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {article.titleOriginal}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {article.originalSourceName || article.source.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusStyles[article.status] || statusStyles.SKIPPED}`}
                    >
                      {article.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {article.enrichment && (
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${sentimentStyles[article.enrichment.sentiment] || sentimentStyles.NEUTRAL}`}
                      >
                        {article.enrichment.sentiment}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {article.enrichment && (
                      <div className="flex flex-wrap gap-1">
                        {(article.enrichment.tags as string[]).slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex rounded bg-secondary px-1.5 py-0.5 text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {article.postings.length > 0 ? (
                      <Check className="h-4 w-4 text-emerald-600" aria-label="Posted" />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {article.publishedAt
                      ? format(new Date(article.publishedAt), 'MMM d, HH:mm')
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-4 md:hidden">
          {articles.map((article) => (
            <article key={article.id} className="rounded-lg border bg-background p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <Link href={`/articles/${article.id}`} className="font-medium leading-snug hover:text-primary">
                  {article.enrichment?.titleTh || article.titleOriginal}
                </Link>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${statusStyles[article.status] || statusStyles.SKIPPED}`}
                >
                  {article.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {article.originalSourceName || article.source.name}
              </p>
              {article.enrichment && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${sentimentStyles[article.enrichment.sentiment] || sentimentStyles.NEUTRAL}`}
                  >
                    {article.enrichment.sentiment}
                  </span>
                  {(article.enrichment.tags as string[]).slice(0, 2).map((tag) => (
                    <span key={tag} className="rounded bg-secondary px-2 py-0.5 text-[11px]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {article.publishedAt
                    ? format(new Date(article.publishedAt), 'MMM d, HH:mm')
                    : '-'}
                </span>
                <span>{article.postings.length > 0 ? 'Posted' : 'Not posted'}</span>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {startItem} to {endItem} of {total} articles
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="page-size">
            Rows
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => updatePageSize(parseInt(e.target.value, 10))}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>

          <button
            onClick={() => goToPage(1)}
            disabled={page <= 1}
            className="inline-flex items-center rounded-md border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center rounded-md border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pageWindow.map((num) => (
            <button
              key={num}
              onClick={() => goToPage(num)}
              className={`h-8 min-w-8 rounded-md border px-2 text-sm ${
                num === page ? 'bg-primary text-primary-foreground' : 'bg-background'
              }`}
            >
              {num}
            </button>
          ))}

          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex items-center rounded-md border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => goToPage(totalPages)}
            disabled={page >= totalPages}
            className="inline-flex items-center rounded-md border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
