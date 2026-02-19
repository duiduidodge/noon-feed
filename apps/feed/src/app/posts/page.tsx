

import { MyPostsWidget } from '@/components/my-posts-widget';

export default function PostsPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1640px] flex-1 flex-col px-3 py-5 md:px-4 lg:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3 py-1 font-mono-data text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Creator Desk
        </span>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground/95 md:text-5xl">My Intel</h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          Your curated insights and published content timeline.
        </p>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/75 shadow-sm column-panel">
          <MyPostsWidget />
        </div>
      </div>
    </main>
  );
}
