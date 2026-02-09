import { prisma } from '@/lib/prisma';
import { PostsList } from '@/components/posts-list';

export const dynamic = 'force-dynamic';

export default async function PostsPage() {
  const posts = await prisma.userPost.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Posts</h1>
        <p className="text-muted-foreground">
          Create and manage social media style posts
        </p>
      </div>

      <PostsList posts={JSON.parse(JSON.stringify(posts))} />
    </div>
  );
}
