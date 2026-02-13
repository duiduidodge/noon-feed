import { SentimentBadge } from './sentiment-badge';
import { formatTimeAgo } from '@/lib/utils';
import { clsx } from 'clsx';

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

// Source color map for instant visual recognition
const SOURCE_COLORS: Record<string, string> = {
  COINDESK: 'bg-blue-500',
  COINTELEGRAPH: 'bg-amber-500',
  THEBLOCK: 'bg-violet-500',
  DECRYPT: 'bg-emerald-500',
  BITCOINMAGAZINE: 'bg-orange-500',
  BLOCKWORKS: 'bg-cyan-500',
  DEFIANT: 'bg-rose-500',
};

function getSourceColor(name: string): string {
  const key = name.toUpperCase().replace(/[\s._-]/g, '');
  return SOURCE_COLORS[key] || 'bg-muted-foreground/50';
}

export function NewsCard({ article, index = 0 }: NewsCardProps) {
  const isHighImpact = article.marketImpact === 'HIGH';

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        'animate-fade-up stagger group block border-b border-border/30 px-5 py-4 transition-all duration-200 hover:bg-surface/40',
        isHighImpact && 'card-high-impact'
      )}
      style={{ '--stagger': index } as React.CSSProperties}
    >
      {/* Source + time + sentiment */}
      <div className="mb-1.5 flex items-center gap-2">
        {/* Source color dot */}
        <span className={clsx('h-1.5 w-1.5 rounded-full shrink-0', getSourceColor(article.sourceName))} />
        <span className="font-mono-data text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {article.sourceName}
        </span>
        {article.publishedAt && (
          <>
            <span className="text-border">&middot;</span>
            <span className="font-mono-data text-[10px] text-muted-foreground/70">
              {formatTimeAgo(article.publishedAt)}
            </span>
          </>
        )}
        {isHighImpact && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-orange-500/40 animate-pulse-ring" />
            <span className="relative h-2 w-2 rounded-full bg-orange-500/80" />
          </span>
        )}
        <div className="ml-auto">
          <SentimentBadge sentiment={article.sentiment} />
        </div>
      </div>

      {/* Title */}
      <h3 className="mb-1 font-display text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors duration-200">
        {article.title}
      </h3>

      {/* Snippet */}
      {article.snippet && (
        <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {article.snippet}
        </p>
      )}

      {/* Tags */}
      {article.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {article.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-md bg-surface/70 border border-border/50 px-1.5 py-0.5 font-mono-data text-[9px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}
