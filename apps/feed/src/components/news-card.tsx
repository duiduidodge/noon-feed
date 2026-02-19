import { formatTimeAgo } from '@/lib/utils';
import { clsx } from 'clsx';
import { Flame } from 'lucide-react';

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

function getSourceColor(name: string) {
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
        'group relative block border-b border-border/40 px-4 md:px-5 py-4 md:py-5 transition-all duration-300 hover:bg-surface/45',
        'overflow-hidden',
        isHighImpact && 'card-high-impact'
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Hover Highlight */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

      {/* Top Meta Row */}
      <div className="relative mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Source Badge */}
          <div className="flex items-center gap-1.5 rounded-full border border-border/55 bg-surface/45 px-2 py-0.5 backdrop-blur-sm transition-colors group-hover:bg-surface/70 group-hover:border-border/70">
            <span className={clsx('h-1.5 w-1.5 rounded-full shrink-0', getSourceColor(article.sourceName))} />
            <span className="font-mono-data text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/78 group-hover:text-foreground transition-colors">
              {article.sourceName}
            </span>
          </div>

          <span className="text-[11px] text-border/40">•</span>

          <span className="font-mono-data text-[11px] text-muted-foreground/75 group-hover:text-muted-foreground/95 transition-colors">
            {article.publishedAt ? formatTimeAgo(article.publishedAt) : 'Just now'}
          </span>
        </div>

        {isHighImpact && (
          <div className="flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 backdrop-blur-md shadow-[0_0_12px_-3px_rgba(249,115,22,0.4)]">
            <Flame className="h-3 w-3 fill-orange-500 text-orange-500 animate-pulse" />
            <span className="font-mono-data text-[9px] font-bold uppercase tracking-wider text-orange-500">
              High Impact
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="relative mb-2.5 font-thai text-[15px] md:text-[16px] font-semibold leading-relaxed text-foreground/95 transition-colors duration-200 group-hover:text-foreground">
        {article.title}
      </h3>

      {/* Snippet */}
      {article.snippet && (
        <p className="relative line-clamp-2 font-sans text-[12.5px] md:text-[13px] leading-relaxed text-muted-foreground/85 transition-colors group-hover:text-foreground/80">
          {article.snippet}
        </p>
      )}

      {/* Footer / Sentiment (Hidden by default, shown on hover/expansion idea if we had space, but for now just subtle sentiment bar) */}
      <div className={clsx(
        "absolute bottom-0 left-0 h-[2px] w-full transition-all duration-500",
        article.sentiment === 'POSITIVE' ? 'bg-bullish' : article.sentiment === 'NEGATIVE' ? 'bg-bearish' : 'bg-transparent',
        "opacity-0 group-hover:opacity-40"
      )} />
    </a>
  );
}
