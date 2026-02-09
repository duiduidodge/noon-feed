import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import { ArticleActions } from '@/components/article-actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default async function ArticleDetailPage({ params }: PageProps) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: {
      source: true,
      enrichment: true,
      postings: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!article) {
    notFound();
  }

  const sentimentColors: Record<string, string> = {
    BULLISH: 'bg-green-100 text-green-800 border-green-200',
    BEARISH: 'bg-red-100 text-red-800 border-red-200',
    NEUTRAL: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const impactColors: Record<string, string> = {
    HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
    MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    LOW: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[1fr_220px]">
      <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">
              {article.enrichment?.titleTh || article.titleOriginal}
            </h1>
            <p className="text-muted-foreground">{article.titleOriginal}</p>
          </div>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm hover:bg-accent"
          >
            <ExternalLink className="h-4 w-4" />
            View Original
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-md bg-secondary px-2 py-1">
            {article.originalSourceName || article.source.name}
          </span>
          <span className="text-muted-foreground">
            {article.publishedAt
              ? format(new Date(article.publishedAt), 'MMMM d, yyyy HH:mm')
              : 'Unknown date'}
          </span>
          <span
            className={`rounded-md border px-2 py-1 text-xs font-medium ${
              article.status === 'ENRICHED'
                ? 'bg-green-50 text-green-700 border-green-200'
                : article.status === 'FAILED'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-yellow-50 text-yellow-700 border-yellow-200'
            }`}
          >
            {article.status}
          </span>
        </div>
      </div>

      {article.enrichment ? (
        <>
          {/* Sentiment & Impact */}
          <div className="flex gap-4">
            <div
              className={`flex-1 rounded-lg border p-4 ${sentimentColors[article.enrichment.sentiment]}`}
            >
              <p className="text-sm font-medium">Sentiment</p>
              <p className="text-lg font-bold">{article.enrichment.sentiment}</p>
            </div>
            <div
              className={`flex-1 rounded-lg border p-4 ${impactColors[article.enrichment.marketImpact]}`}
            >
              <p className="text-sm font-medium">Market Impact</p>
              <p className="text-lg font-bold">{article.enrichment.marketImpact}</p>
            </div>
          </div>

          {/* Summary */}
          <div id="summary" className="rounded-lg border bg-card p-6">
            <h2 className="mb-3 text-lg font-semibold">📝 สรุป (Summary)</h2>
            <p className="text-lg leading-relaxed">{article.enrichment.summaryTh}</p>
          </div>

          {/* Tags */}
          <div id="tags" className="rounded-lg border bg-card p-6">
            <h2 className="mb-3 text-lg font-semibold">🏷️ Tags</h2>
            <div className="flex flex-wrap gap-2">
              {(article.enrichment.tags as string[]).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Social Content Draft */}
          <div id="draft" className="rounded-lg border bg-card p-6">
            <h2 className="mb-3 text-lg font-semibold">📰 Social Content Draft</h2>
            {article.enrichment.contentDraftTh ? (
              <p className="whitespace-pre-wrap text-lg leading-relaxed">
                {article.enrichment.contentDraftTh}
              </p>
            ) : (
              <p className="text-muted-foreground">
                No draft yet. Use “Generate Content” to create an article-style social post.
              </p>
            )}
          </div>

          {/* Cautions */}
          {article.enrichment.cautions &&
            (article.enrichment.cautions as string[]).length > 0 && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
                <h2 className="mb-3 text-lg font-semibold text-yellow-800">
                  ⚠️ ข้อควรระวัง (Cautions)
                </h2>
                <ul className="list-disc space-y-1 pl-5 text-yellow-700">
                  {(article.enrichment.cautions as string[]).map((caution, index) => (
                    <li key={index}>{caution}</li>
                  ))}
                </ul>
              </div>
            )}

          {/* Actions */}
          <ArticleActions articleId={article.id} />
        </>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            This article has not been enriched yet. Status: {article.status}
          </p>
        </div>
      )}

      {/* Original Text (collapsible) */}
      {article.extractedText && (
        <details id="source-text" className="rounded-lg border bg-card">
          <summary className="cursor-pointer p-6 font-semibold">
            📄 Original Extracted Text
          </summary>
          <div className="border-t p-6">
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">
              {article.extractedText}
            </pre>
          </div>
        </details>
      )}

      {/* Posting History */}
      {article.postings.length > 0 && (
        <div id="history" className="rounded-lg border bg-card p-6">
          <h2 className="mb-3 text-lg font-semibold">📤 Posting History</h2>
          <div className="space-y-2">
            {article.postings.map((posting) => (
              <div
                key={posting.id}
                className="flex items-center justify-between rounded-md bg-muted p-3"
              >
                <div>
                  <span className="font-medium">Channel: {posting.discordChannelId}</span>
                  {posting.postedAt && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      {format(new Date(posting.postedAt), 'MMM d, HH:mm')}
                    </span>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    posting.status === 'POSTED'
                      ? 'bg-green-100 text-green-800'
                      : posting.status === 'FAILED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {posting.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
      <aside className="hidden xl:block">
        <div className="sticky top-20 rounded-lg border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            On this page
          </p>
          <nav className="mt-3 space-y-1 text-sm">
            <a className="block rounded px-2 py-1 hover:bg-accent" href="#summary">Summary</a>
            <a className="block rounded px-2 py-1 hover:bg-accent" href="#tags">Tags</a>
            <a className="block rounded px-2 py-1 hover:bg-accent" href="#draft">Social Draft</a>
            {article.extractedText && (
              <a className="block rounded px-2 py-1 hover:bg-accent" href="#source-text">
                Source Text
              </a>
            )}
            {article.postings.length > 0 && (
              <a className="block rounded px-2 py-1 hover:bg-accent" href="#history">
                Posting History
              </a>
            )}
          </nav>
        </div>
      </aside>
    </div>
  );
}
