import { prisma } from '@/lib/prisma';
import { ArticlesList } from '@/components/articles-list';
import { ArticleFilters } from '@/components/article-filters';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: {
    page?: string;
    pageSize?: string;
    status?: string;
    source?: string;
    sentiment?: string;
    search?: string;
    tag?: string;
  };
}

export default async function ArticlesPage({ searchParams }: PageProps) {
  const page = Math.max(1, parseInt(searchParams.page || '1'));
  const pageSize = [10, 20, 50].includes(parseInt(searchParams.pageSize || '20'))
    ? parseInt(searchParams.pageSize || '20')
    : 20;

  // Build where clause
  const where: any = {};

  if (searchParams.status) {
    where.status = searchParams.status;
  }

  if (searchParams.source) {
    where.sourceId = searchParams.source;
  }

  if (searchParams.sentiment) {
    where.enrichment = {
      ...where.enrichment,
      sentiment: searchParams.sentiment,
    };
  }

  if (searchParams.tag) {
    where.enrichment = {
      ...where.enrichment,
      tags: { array_contains: [searchParams.tag] },
    };
  }

  if (searchParams.search) {
    where.OR = [
      { titleOriginal: { contains: searchParams.search, mode: 'insensitive' } },
      { enrichment: { titleTh: { contains: searchParams.search, mode: 'insensitive' } } },
    ];
  }

  const [articles, total, sources] = await Promise.all([
    prisma.article.findMany({
      where,
      select: {
        id: true,
        titleOriginal: true,
        publishedAt: true,
        url: true,
        status: true,
        originalSourceName: true,
        source: { select: { id: true, name: true } },
        enrichment: true,
        postings: {
          select: { status: true, postedAt: true },
          where: { status: 'POSTED' },
          take: 1,
        },
      },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.article.count({ where }),
    prisma.source.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Articles</h1>
        <p className="text-muted-foreground">
          Browse and manage all fetched news articles
        </p>
      </div>

      <ArticleFilters sources={sources} />

      <ArticlesList
        articles={articles}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        total={total}
      />
    </div>
  );
}
