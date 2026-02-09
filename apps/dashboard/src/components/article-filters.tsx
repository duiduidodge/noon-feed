'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useState } from 'react';

interface Source {
  id: string;
  name: string;
}

interface ArticleFiltersProps {
  sources: Source[];
}

const statuses = ['PENDING', 'FETCHED', 'ENRICHED', 'FAILED', 'SKIPPED'];
const sentiments = ['BULLISH', 'BEARISH', 'NEUTRAL'];
const tags = [
  'BTC', 'ETH', 'DeFi', 'NFT', 'Memecoin', 'ETF', 'Macro',
  'Regulation', 'L2', 'AI', 'Stablecoin', 'Exchange',
];

export function ArticleFilters({ sources }: ArticleFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1'); // Reset to first page
    router.push(`/articles?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter('search', search);
  };

  const clearFilters = () => {
    router.push('/articles');
    setSearch('');
  };

  const activeFilters = [
    searchParams.get('search')
      ? { key: 'search', label: `Search: ${searchParams.get('search')}` }
      : null,
    searchParams.get('status')
      ? { key: 'status', label: `Status: ${searchParams.get('status')}` }
      : null,
    searchParams.get('source')
      ? {
          key: 'source',
          label: `Source: ${sources.find((s) => s.id === searchParams.get('source'))?.name || 'Unknown'}`,
        }
      : null,
    searchParams.get('sentiment')
      ? { key: 'sentiment', label: `Sentiment: ${searchParams.get('sentiment')}` }
      : null,
    searchParams.get('tag')
      ? { key: 'tag', label: `Tag: ${searchParams.get('tag')}` }
      : null,
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search articles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </form>

        {/* Status filter */}
        <select
          value={searchParams.get('status') || ''}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Status</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        {/* Source filter */}
        <select
          value={searchParams.get('source') || ''}
          onChange={(e) => updateFilter('source', e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Sources</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>

        {/* Sentiment filter */}
        <select
          value={searchParams.get('sentiment') || ''}
          onChange={(e) => updateFilter('sentiment', e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Sentiment</option>
          {sentiments.map((sentiment) => (
            <option key={sentiment} value={sentiment}>
              {sentiment}
            </option>
          ))}
        </select>

        {/* Tag filter */}
        <select
          value={searchParams.get('tag') || ''}
          onChange={(e) => updateFilter('tag', e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Tags</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>

        {/* Clear filters */}
        <button
          onClick={clearFilters}
          className="rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          Clear
        </button>
      </div>
      {activeFilters.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => updateFilter(filter.key, '')}
              className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-xs"
            >
              {filter.label}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button
            onClick={clearFilters}
            className="text-xs font-medium text-primary hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
