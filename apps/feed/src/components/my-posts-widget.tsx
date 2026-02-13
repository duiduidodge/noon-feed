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
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              {/* Icon cluster */}
              <div className="relative mb-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 shadow-sm">
                  <PenLine className="h-6 w-6 text-primary/60" />
                </div>
                <Sparkles className="absolute -right-2 -top-2 h-4 w-4 text-primary/40 animate-pulse" />
              </div>
              <p className="font-display text-sm font-bold text-foreground/80 mb-1.5">
                No posts yet
              </p>
              <p className="text-xs text-muted-foreground/60 mb-5 max-w-[200px] leading-relaxed">
                Transform crypto news into engaging content for your audience
              </p>
              {/* CTA Button */}
              <button className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 border border-primary/25 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 hover:border-primary/40 transition-all duration-200 group">
                <PenLine className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                Create First Post
              </button>
              {/* Ghost skeleton preview */}
              <div className="w-full space-y-2.5 opacity-20 mt-6">
                <div className="h-3 w-4/5 rounded-full bg-surface" />
                <div className="h-2.5 w-full rounded-full bg-surface" />
                <div className="h-2.5 w-2/3 rounded-full bg-surface" />
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
