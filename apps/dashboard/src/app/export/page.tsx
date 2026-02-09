'use client';

import { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';

const tags = [
  'BTC', 'ETH', 'DeFi', 'NFT', 'Memecoin', 'ETF', 'Macro',
  'Regulation', 'L2', 'AI', 'Stablecoin', 'Exchange',
];

const sentiments = ['BULLISH', 'BEARISH', 'NEUTRAL'];
const impacts = ['HIGH', 'MEDIUM', 'LOW'];

export default function ExportPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    sentiment: '',
    marketImpact: '',
    tags: [] as string[],
  });

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.sentiment) params.set('sentiment', filters.sentiment.toLowerCase());
    if (filters.marketImpact) params.set('marketImpact', filters.marketImpact.toLowerCase());
    filters.tags.forEach((tag) => params.append('tags', tag));
    return params.toString();
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setLoading(format);
    setStatusMessage(null);
    try {
      const queryString = buildQueryString();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/export.${format}?${queryString}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crypto-news-export-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setStatusMessage(`Exported ${format.toUpperCase()} successfully.`);
    } catch {
      setStatusMessage('Export failed. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const toggleTag = (tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Export</h1>
        <p className="text-muted-foreground">
          Export articles for social media content or further analysis
        </p>
      </div>
      {statusMessage && (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm" role="status">
          {statusMessage}
        </div>
      )}

      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Filters</h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Date Range */}
          <div>
            <label className="mb-1 block text-sm font-medium">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Sentiment */}
          <div>
            <label className="mb-1 block text-sm font-medium">Sentiment</label>
            <select
              value={filters.sentiment}
              onChange={(e) => setFilters((prev) => ({ ...prev, sentiment: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">All Sentiments</option>
              {sentiments.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Market Impact */}
          <div>
            <label className="mb-1 block text-sm font-medium">Market Impact</label>
            <select
              value={filters.marketImpact}
              onChange={(e) => setFilters((prev) => ({ ...prev, marketImpact: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">All Impacts</option>
              {impacts.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags */}
        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium">Tags (select multiple)</label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  filters.tags.includes(tag)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Export Format</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Choose your preferred format. CSV is compatible with Excel and Google Sheets.
          JSON is useful for programmatic access.
        </p>

        <div className="flex gap-4">
          <button
            onClick={() => handleExport('csv')}
            disabled={loading !== null}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading === 'csv' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-5 w-5" />
            )}
            Export CSV
          </button>

          <button
            onClick={() => handleExport('json')}
            disabled={loading !== null}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-6 py-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {loading === 'json' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileJson className="h-5 w-5" />
            )}
            Export JSON
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Export Contents</h2>
        <p className="text-sm text-muted-foreground">
          The export will include the following fields for each article:
        </p>
        <ul className="mt-4 grid gap-2 text-sm md:grid-cols-2">
          <li className="flex items-center gap-2">
            <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">title_th</span>
            Thai headline
          </li>
          <li className="flex items-center gap-2">
            <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">summary_th</span>
            Summary (Thai)
          </li>
          <li className="flex items-center gap-2">
            <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">
              content_draft_th
            </span>
            Social content draft (Thai)
          </li>
          <li className="flex items-center gap-2">
            <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">url</span>
            Original article URL
          </li>
          <li className="flex items-center gap-2">
            <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">source</span>
            News source name
          </li>
          <li className="flex items-center gap-2">
            <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">publishedAt</span>
            Publication date
          </li>
          <li className="flex items-center gap-2">
            <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">tags</span>
            Topic tags
          </li>
          <li className="flex items-center gap-2">
            <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">sentiment</span>
            Market sentiment
          </li>
          <li className="flex items-center gap-2">
            <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">marketImpact</span>
            Impact level
          </li>
        </ul>
      </div>
    </div>
  );
}
