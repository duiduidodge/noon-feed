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

const FIXED_AVATAR_URL =
  'https://grleehzftxkszwherpma.supabase.co/storage/v1/object/public/posts/posts/1770637133179-wqvy1s.png';

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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
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
            <Image src={FIXED_AVATAR_URL} alt="Profile picture" fill className="object-cover" />
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
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-card via-card to-surface shadow-[0_30px_120px_hsl(0_0%_0%/0.6)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="max-h-[86vh] overflow-y-auto custom-scrollbar">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 z-10 rounded-full border border-border/40 bg-background/70 p-1.5 text-muted-foreground backdrop-blur hover:text-foreground"
                aria-label="Close post"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 border-b border-border/35 px-5 py-4 pr-12">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-accent/30 bg-surface/70">
                  <Image src={FIXED_AVATAR_URL} alt="Profile picture" fill className="object-cover" />
                </div>
                <div className="min-w-0">
                  <h3 className="line-clamp-2 text-xl font-bold tracking-tight text-foreground">
                    {post.title}
                  </h3>
                  <p className="mt-0.5 font-mono-data text-[11px] uppercase tracking-wider text-muted-foreground/65">
                    {formatTimeAgo(post.createdAt)}
                  </p>
                </div>
              </div>

              {post.imageUrl && (
                <div className="relative m-5 mb-0 overflow-hidden rounded-xl border border-border/30">
                  <Image
                    src={post.imageUrl}
                    alt={post.title}
                    width={900}
                    height={500}
                    className="max-h-[60vh] w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent" />
                </div>
              )}

              <div className="px-5 pb-5 pt-4">
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/95">
                  {post.content}
                </p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
