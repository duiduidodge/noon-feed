import { prisma } from '@/lib/prisma';
import { SourcesList } from '@/components/sources-list';

export const dynamic = 'force-dynamic';

export default async function SourcesPage() {
  const sources = await prisma.source.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { articles: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sources</h1>
        <p className="text-muted-foreground">
          Manage RSS feeds and news sources
        </p>
      </div>

      <SourcesList sources={sources} />
    </div>
  );
}
