'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Loader2, PenLine, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { WidgetCard } from './widget-card';
import { PostCard, type UserPostItem } from './post-card';

interface PostsResponse {
  posts: UserPostItem[];
}

async function fetchPosts(): Promise<PostsResponse> {
  const res = await fetch('/api/posts?limit=5');
  if (!res.ok) throw new Error('Failed to fetch posts');
  return res.json();
}

export function MyPostsWidget() {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['my-posts'],
    queryFn: fetchPosts,
    refetchInterval: 2 * 60_000,
  });

  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return (
    <WidgetCard
      title="My Posts"
      headerRight={
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground/60">
              Feed
            </span>
            {dataUpdatedAt > 0 && (
              <div className="font-mono-data text-[10px] text-muted-foreground/45">
                {new Date(dataUpdatedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
          <button
            onClick={toggleCollapse}
            className="flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-surface/60 transition-all duration-200"
            aria-label={collapsed ? 'Expand posts' : 'Collapse posts'}
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      }
    >
      <div
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: collapsed ? '0px' : '560px',
          opacity: collapsed ? 0 : 1,
        }}
      >
        <div className="max-h-[min(60vh,560px)] overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center font-mono-data text-xs text-muted-foreground/50">
              Posts unavailable
            </div>
          ) : data?.posts.length === 0 ? (
            /* Enhanced empty state */
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              {/* Icon cluster */}
              <div className="relative mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 border border-primary/15">
                  <PenLine className="h-5 w-5 text-primary/60" />
                </div>
                <Sparkles className="absolute -right-1.5 -top-1.5 h-4 w-4 text-primary/40 animate-pulse" />
              </div>
              <p className="font-display text-sm font-semibold text-foreground/70 mb-1">
                No posts yet
              </p>
              <p className="text-xs text-muted-foreground/60 mb-4 max-w-[180px] leading-relaxed">
                Your published posts and analysis will appear here
              </p>
              {/* Ghost skeleton preview */}
              <div className="w-full space-y-2 opacity-30">
                <div className="h-2.5 w-3/4 rounded bg-surface" />
                <div className="h-2 w-full rounded bg-surface" />
                <div className="h-2 w-1/2 rounded bg-surface" />
              </div>
            </div>
          ) : (
            data?.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          )}
        </div>
      </div>
    </WidgetCard>
  );
}
