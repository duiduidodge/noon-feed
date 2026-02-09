'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Check, X, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react';

interface Source {
  id: string;
  name: string;
  type: string;
  url: string;
  enabled: boolean;
  category: string | null;
  createdAt: Date;
  _count: { articles: number };
}

interface SourcesListProps {
  sources: Source[];
}

export function SourcesList({ sources: initialSources }: SourcesListProps) {
  const [sources, setSources] = useState(initialSources);
  const [sortBy, setSortBy] = useState<'name' | 'articles'>('name');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortedSources = useMemo(() => {
    return [...sources].sort((a, b) => {
      if (sortBy === 'articles') return b._count.articles - a._count.articles;
      return a.name.localeCompare(b.name);
    });
  }, [sources, sortBy]);

  const toggleEnabled = async (sourceId: string, currentEnabled: boolean) => {
    setErrorMessage(null);

    setSources((prev) =>
      prev.map((s) =>
        s.id === sourceId ? { ...s, enabled: !currentEnabled } : s
      )
    );

    try {
      const response = await fetch(`/api/sources/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });

      if (!response.ok) {
        throw new Error('Update failed');
      }
    } catch {
      setSources((prev) =>
        prev.map((s) =>
          s.id === sourceId ? { ...s, enabled: currentEnabled } : s
        )
      );
      setErrorMessage('Unable to update source status. Please retry.');
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-medium">Configured sources</p>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'name' | 'articles')}
          className="rounded-md border bg-background px-2 py-1 text-xs"
          aria-label="Sort sources"
        >
          <option value="name">Sort by name</option>
          <option value="articles">Sort by article volume</option>
        </select>
      </div>

      {errorMessage && (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {errorMessage}
        </div>
      )}

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead className="sticky top-0 border-b bg-muted/60">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Source</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Articles</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Added</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedSources.map((source) => (
              <tr key={source.id} className="hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">{source.name}</p>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block max-w-xs truncate text-sm text-muted-foreground hover:text-primary"
                    >
                      {source.url}
                    </a>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-secondary px-2 py-1 text-xs">
                    {source.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{source.category || '-'}</td>
                <td className="px-4 py-3 text-sm font-medium">{source._count.articles}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                      source.enabled
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {source.enabled ? (
                      <>
                        <Check className="h-3 w-3" />
                        Enabled
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3" />
                        Disabled
                      </>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {format(new Date(source.createdAt), 'MMM d, yyyy')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleEnabled(source.id, source.enabled)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title={source.enabled ? 'Disable' : 'Enable'}
                      aria-label={source.enabled ? 'Disable source' : 'Enable source'}
                    >
                      {source.enabled ? (
                        <ToggleRight className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </button>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Open source URL"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {sortedSources.map((source) => (
          <article key={source.id} className="rounded-lg border bg-background p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{source.name}</p>
                <p className="text-xs text-muted-foreground">{source.type}</p>
              </div>
              <button
                onClick={() => toggleEnabled(source.id, source.enabled)}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={source.enabled ? 'Disable source' : 'Enable source'}
              >
                {source.enabled ? (
                  <ToggleRight className="h-5 w-5 text-emerald-600" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Articles: {source._count.articles}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{source.category || 'No category'}</span>
              <span>{format(new Date(source.createdAt), 'MMM d, yyyy')}</span>
            </div>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex text-xs text-primary"
            >
              Open source
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}
