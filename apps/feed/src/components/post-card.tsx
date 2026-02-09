'use client';

import { formatTimeAgo } from '@/lib/utils';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface UserPostItem {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
}

interface PostCardProps {
  post: UserPostItem;
}

export function PostCard({ post }: PostCardProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const previewText =
    post.content.length > 140 ? `${post.content.slice(0, 140).replace(/\s+\S*$/, '')}...` : post.content;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full border-b border-border/30 px-4 py-3 text-left transition-colors hover:bg-surface/30"
      >
        <div className="flex items-start gap-3">
          <div className="relative mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-full border border-accent/40 bg-surface/70">
            {post.imageUrl ? (
              <Image src={post.imageUrl} alt={post.title} fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-mono-data text-xs text-muted-foreground">
                U
              </div>
            )}
          </div>

          <div className="relative min-w-0 flex-1 rounded-2xl border border-border/35 bg-surface/40 px-3 py-2">
            <div className="absolute -left-1 top-3 h-2.5 w-2.5 rotate-45 border-b border-l border-border/35 bg-surface/40" />

            <h4 className="line-clamp-1 text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
              {post.title}
            </h4>

            <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
              {previewText}
            </p>

            <span className="mt-1.5 block font-mono-data text-[10px] text-muted-foreground/55">
              {formatTimeAgo(post.createdAt)}
            </span>
          </div>
        </div>
      </button>

      {mounted && open && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-xl rounded-xl border border-border/40 bg-card p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-surface/60 hover:text-foreground"
              aria-label="Close post"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pr-8">
              <h3 className="text-base font-semibold text-foreground">{post.title}</h3>
              <p className="mt-1 font-mono-data text-[11px] text-muted-foreground/60">
                {formatTimeAgo(post.createdAt)}
              </p>
            </div>

            {post.imageUrl && (
              <div className="relative mt-3 overflow-hidden rounded-lg border border-border/30">
                <Image
                  src={post.imageUrl}
                  alt={post.title}
                  width={900}
                  height={500}
                  className="max-h-[46vh] w-full object-cover"
                />
              </div>
            )}

            <p className="mt-3 max-h-[35vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground/95 custom-scrollbar">
              {post.content}
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
