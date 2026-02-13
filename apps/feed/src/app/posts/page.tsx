

import { MyPostsWidget } from '@/components/my-posts-widget';

export default function PostsPage() {
    return (
        <main className="mx-auto flex w-full max-w-[1780px] flex-1 flex-col px-4 py-6 lg:px-5">
            <div className="mx-auto w-full max-w-2xl space-y-6">
                <h1 className="font-display text-4xl font-bold tracking-tight text-foreground/90">My Intel</h1>
                <p className="max-w-xl text-muted-foreground">
                    Your curated insights and published content.
                </p>

                <div className="mt-8 overflow-hidden rounded-2xl border border-border/60 bg-card/50 shadow-sm column-panel">
                    <MyPostsWidget />
                </div>
            </div>
        </main>
    );
}
