'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
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

  return (
    <WidgetCard
      title="My Posts"
      headerRight={
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
      }
    >
      <div className="max-h-[min(60vh,560px)] overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-accent/50" />
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center font-mono-data text-xs text-muted-foreground/50">
            Posts unavailable
          </div>
        ) : data?.posts.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono-data text-xs text-muted-foreground/50">
            No posts yet
          </div>
        ) : (
          data?.posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))
        )}
      </div>
    </WidgetCard>
  );
}
