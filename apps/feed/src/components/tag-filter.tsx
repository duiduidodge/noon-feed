'use client';

import { clsx } from 'clsx';

const TAGS = [
  'BTC', 'ETH', 'DeFi', 'NFT', 'Memecoin', 'ETF', 'Macro',
  'Regulation', 'L2', 'AI', 'Stablecoin', 'Exchange',
];

interface TagFilterProps {
  selectedTag: string | null;
  onTagSelect: (tag: string | null) => void;
}

export function TagFilter({ selectedTag, onTagSelect }: TagFilterProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 py-3" role="tablist" aria-label="Filter by tag">
      <TagButton
        active={!selectedTag}
        onClick={() => onTagSelect(null)}
      >
        All
      </TagButton>
      {TAGS.map((tag) => (
        <TagButton
          key={tag}
          active={selectedTag === tag}
          onClick={() => onTagSelect(selectedTag === tag ? null : tag)}
        >
          {tag}
        </TagButton>
      ))}
    </div>
  );
}

function TagButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={clsx(
        'shrink-0 rounded-full px-3 py-1.5 font-mono-data text-xs font-medium uppercase tracking-wide transition-all duration-200 border',
        active
          ? 'bg-accent/15 text-accent border-accent/40 shadow-[0_0_8px_hsl(var(--accent)/0.15)]'
          : 'bg-transparent text-muted-foreground border-border/50 hover:border-accent/30 hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}
