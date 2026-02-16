'use client';

import { formatTimeAgo } from '@/lib/utils';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { X, Maximize2 } from 'lucide-react';
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
  'https://grleehzftxkszwherpma.supabase.co/storage/v1/object/public/posts/posts/1770636237169-r6948j.png';

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
        className="group w-full relative border-b border-border/30 px-5 py-4 text-left transition-all duration-300 hover:bg-surface/40 overflow-hidden"
      >
        {/* Subtle hover gradient */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

        <div className="flex items-start gap-3.5">
          {/* Avatar with glow */}
          <div className="relative mt-1 h-10 w-10 shrink-0">
            <div className="absolute -inset-0.5 rounded-full bg-primary/20 blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative h-full w-full overflow-hidden rounded-full border border-primary/20 bg-surface/70 ring-2 ring-transparent group-hover:ring-primary/10 transition-all">
              <Image src={FIXED_AVATAR_URL} alt="Profile picture" fill className="object-cover" />
            </div>
          </div>

          <div className="relative min-w-0 flex-1">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-thai text-[15px] font-semibold text-foreground/90 group-hover:text-primary transition-colors line-clamp-1 leading-snug">
                {post.title}
              </h4>
              <span className="shrink-0 font-mono-data text-[10px] text-muted-foreground/50 mt-0.5 whitespace-nowrap">
                {formatTimeAgo(post.createdAt)}
              </span>
            </div>

            {/* Bubble Container */}
            <div className="relative rounded-2xl border border-border/30 bg-surface/30 px-3.5 py-2.5 backdrop-blur-sm group-hover:bg-surface/50 group-hover:border-primary/20 transition-all duration-300">
              {/* Arrow */}
              <div className="absolute -left-1.5 top-3 h-2.5 w-2.5 rotate-45 border-b border-l border-border/30 bg-surface/30 group-hover:bg-surface/50 group-hover:border-primary/20 transition-all duration-300" />

              {post.imageUrl && (
                <div className="relative mb-2.5 overflow-hidden rounded-lg border border-border/20 shadow-sm">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Image
                    src={post.imageUrl}
                    alt={post.title}
                    width={800}
                    height={360}
                    className="h-28 w-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute right-2 bottom-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/40 backdrop-blur-md p-1 rounded-full text-white/80">
                      <Maximize2 className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              )}

              <p className="line-clamp-2 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80 font-sans group-hover:text-foreground/90 transition-colors">
                {previewText}
              </p>
            </div>
          </div>
        </div>
      </button>

      {mounted && open && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-background/80 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-border/40 bg-background/50 px-5 py-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-primary/20 bg-surface/70">
                  <Image src={FIXED_AVATAR_URL} alt="Profile picture" fill className="object-cover" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground">You</span>
                  <span className="font-mono-data text-[10px] text-muted-foreground/70">
                    {formatTimeAgo(post.createdAt)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-surface/50 p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
                aria-label="Close post"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(85vh-70px)] overflow-y-auto custom-scrollbar bg-surface/20">
              <div className="p-6">
                <h3 className="font-display text-xl leading-snug font-bold tracking-tight text-foreground mb-4">
                  {post.title}
                </h3>

                {post.imageUrl && (
                  <div className="relative mb-6 overflow-hidden rounded-xl border border-border/30 shadow-md group">
                    <Image
                      src={post.imageUrl}
                      alt={post.title}
                      width={900}
                      height={500}
                      className="w-full object-cover max-h-[50vh]"
                    />
                  </div>
                )}

                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground/90 font-sans">
                    {post.content}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
