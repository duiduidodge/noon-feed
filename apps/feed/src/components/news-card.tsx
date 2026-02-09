import { SentimentBadge } from './sentiment-badge';
import { formatTimeAgo } from '@/lib/utils';

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

export function NewsCard({ article, index = 0 }: NewsCardProps) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="animate-fade-up stagger group block border-b border-border/30 px-4 py-4 transition-all duration-200 hover:bg-surface/50"
      style={{ '--stagger': index } as React.CSSProperties}
    >
      {/* Source + time + sentiment */}
      <div className="mb-1.5 flex items-center gap-2">
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
        {article.marketImpact === 'HIGH' && (
          <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_4px_hsl(30_90%_55%/0.6)]" />
        )}
        <div className="ml-auto">
          <SentimentBadge sentiment={article.sentiment} />
        </div>
      </div>

      {/* Title */}
      <h3 className="mb-1 font-display text-sm font-semibold leading-snug text-foreground group-hover:text-accent transition-colors duration-200">
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
              className="inline-flex items-center rounded bg-secondary/80 border border-border/40 px-1.5 py-0.5 font-mono-data text-[9px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}
