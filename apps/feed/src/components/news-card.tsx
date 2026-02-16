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
  COINDESK: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
  COINTELEGRAPH: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
  THEBLOCK: 'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]',
  DECRYPT: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
  BITCOINMAGAZINE: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]',
  BLOCKWORKS: 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]',
  DEFIANT: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]',
};

function getSourceColor(name: string): string {
  const key = name.toUpperCase().replace(/[\s._-]/g, '');
  return SOURCE_COLORS[key] || 'bg-muted-foreground/50 shadow-none';
}

export function NewsCard({ article, index = 0 }: NewsCardProps) {
  const isHighImpact = article.marketImpact === 'HIGH';

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        'group relative block border-b border-border/30 px-5 py-5 transition-all duration-300 hover:bg-surface/30',
        'overflow-hidden',
        isHighImpact && 'card-high-impact'
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Hover Highlight */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

      {/* Top Meta Row */}
      <div className="relative mb-2 flex items-center gap-2.5">
        {/* Source Dot */}
        <span className={clsx('h-1.5 w-1.5 rounded-full shrink-0 transition-transform group-hover:scale-125', getSourceColor(article.sourceName))} />

        <span className="font-mono-data text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
          {article.sourceName}
        </span>

        {article.publishedAt && (
          <>
            <span className="text-[10px] text-border/60">•</span>
            <span className="font-mono-data text-[10px] text-muted-foreground/60">
              {formatTimeAgo(article.publishedAt)}
            </span>
          </>
        )}

        {isHighImpact && (
          <div className="ml-auto flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 backdrop-blur-md shadow-[0_0_12px_-3px_rgba(249,115,22,0.4)]">
            <Flame className="h-3 w-3 fill-orange-500 text-orange-500 animate-pulse" />
            <span className="font-mono-data text-[9px] font-bold uppercase tracking-wider text-orange-500">
              High Impact
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="relative mb-2 font-thai text-[15px] font-medium leading-relaxed text-foreground/90 group-hover:text-primary transition-colors duration-200">
        {article.title}
      </h3>

      {/* Snippet */}
      {article.snippet && (
        <p className="relative line-clamp-2 font-sans text-xs leading-relaxed text-muted-foreground/70 group-hover:text-muted-foreground/90 transition-colors">
          {article.snippet}
        </p>
      )}
    </a>
  );
}
