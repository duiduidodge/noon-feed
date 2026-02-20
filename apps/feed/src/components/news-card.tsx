import { formatTimeAgo } from '@/lib/utils';
import { clsx } from 'clsx';
import { Flame, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';

export interface FeedArticle {
  id: string;
  title: string;
  snippet: string;
  sourceName: string;
  publishedAt: string | null;
  url: string;
  sentiment: string;
  marketImpact: string;
  tags: string[];
}

interface NewsCardProps {
  article: FeedArticle;
  index?: number;
}

const SOURCE_COLORS: Record<string, string> = {
  COINDESK: 'bg-blue-500',
  COINTELEGRAPH: 'bg-amber-500',
  THEBLOCK: 'bg-violet-500',
  DECRYPT: 'bg-emerald-500',
  BITCOINMAGAZINE: 'bg-orange-500',
  BLOCKWORKS: 'bg-cyan-500',
  DEFIANT: 'bg-rose-500',
};

function getSourceColor(name: string) {
  const key = name.toUpperCase().replace(/[\s._-]/g, '');
  return SOURCE_COLORS[key] || 'bg-muted-foreground/50';
}

export function NewsCard({ article, index = 0 }: NewsCardProps) {
  const isHighImpact = article.marketImpact === 'HIGH';

  // Button border + text tinted by sentiment — ties the CTA to the article's market signal
  const readBtnClass =
    article.sentiment === 'POSITIVE'
      ? 'border-bullish/20 text-bullish/50 hover:border-bullish/45 hover:text-bullish/85 hover:bg-bullish/5'
      : article.sentiment === 'NEGATIVE'
        ? 'border-bearish/20 text-bearish/40 hover:border-bearish/40 hover:text-bearish/75 hover:bg-bearish/5'
        : 'border-border/28 text-muted-foreground/35 hover:border-primary/35 hover:text-primary/72 hover:bg-primary/5';

  return (
    <article className="group relative">

      {/* ── Main headline link — covers meta + title + snippet ── */}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(
          'relative block px-5 pt-[14px] pb-2 md:px-6 transition-colors duration-150 focus-ring',
          'hover:bg-surface/25',
          isHighImpact && 'bg-orange-500/[0.03]'
        )}
        aria-label={`${article.title} — ${article.sourceName}, ${article.publishedAt ? formatTimeAgo(article.publishedAt) : 'just now'}`}
      >
        {/* Sentiment accent bar — scoped to headline area */}
        <div
          className={clsx(
            'absolute left-0 top-[14px] bottom-[8px] w-[2px] rounded-r-full transition-all duration-150',
            article.sentiment === 'POSITIVE'
              ? 'bg-bullish opacity-35 group-hover:opacity-80'
              : article.sentiment === 'NEGATIVE'
                ? 'bg-bearish opacity-35 group-hover:opacity-80'
                : 'opacity-0'
          )}
          aria-hidden="true"
        />

        <div className="pl-3">
          {/* Meta row */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={clsx('h-2 w-2 rounded-full flex-shrink-0', getSourceColor(article.sourceName))}
              aria-hidden="true"
            />
            <span className="font-mono-data text-[12px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60 group-hover:text-muted-foreground/85 transition-colors duration-150 truncate">
              {article.sourceName}
            </span>

            {article.sentiment === 'POSITIVE' && (
              <TrendingUp className="h-3.5 w-3.5 text-bullish opacity-75 flex-shrink-0" />
            )}
            {article.sentiment === 'NEGATIVE' && (
              <TrendingDown className="h-3.5 w-3.5 text-bearish opacity-75 flex-shrink-0" />
            )}
            {isHighImpact && (
              <div className="flex items-center gap-1 flex-shrink-0 rounded border border-orange-500/35 bg-orange-500/10 px-1.5 py-0.5">
                <Flame className="h-3 w-3 text-orange-400 fill-orange-400 animate-pulse" />
                <span className="font-mono-data text-[10px] font-bold uppercase tracking-widest text-orange-400">
                  Hot
                </span>
              </div>
            )}

            <span className="ml-auto font-mono-data text-[12px] text-muted-foreground/45 group-hover:text-muted-foreground/65 transition-colors duration-150 flex-shrink-0 pl-2 tabular-nums">
              {article.publishedAt ? formatTimeAgo(article.publishedAt) : 'now'}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-[18px] leading-[1.45] font-semibold text-foreground/85 group-hover:text-foreground transition-colors duration-150 line-clamp-2 mb-1.5">
            {article.title}
          </h3>

          {/* Snippet */}
          {article.snippet && (
            <p className="line-clamp-1 text-[13px] leading-relaxed text-muted-foreground/55 group-hover:text-muted-foreground/70 transition-colors duration-150">
              {article.snippet}
            </p>
          )}
        </div>
      </a>

      {/* ── Read Article button ── */}
      {/* Separate <a> outside the headline link — no nested anchors */}
      <div
        className={clsx(
          'flex justify-end px-5 pb-3 pt-1 md:px-6',
          isHighImpact && 'bg-orange-500/[0.03]'
        )}
      >
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(
            'group/btn inline-flex items-center gap-[5px]',
            'font-mono-data text-[10px] font-bold uppercase tracking-[0.16em]',
            'rounded border px-2.5 py-[5px]',
            'transition-all duration-150 focus-ring',
            readBtnClass
          )}
          aria-label={`Read full article: ${article.title}`}
        >
          Read Article
          <ArrowUpRight
            className="h-[11px] w-[11px] transition-transform duration-150 group-hover/btn:translate-x-[2px] group-hover/btn:-translate-y-[2px]"
            aria-hidden="true"
          />
        </a>
      </div>

    </article>
  );
}
