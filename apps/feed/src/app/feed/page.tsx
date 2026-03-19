import { FeedHome } from '@/components/feed-home';
import { getInitialArticles } from '@/lib/feed-data';

export const dynamic = 'force-dynamic';

export default async function FeedModulePage() {
  const initialArticles = await getInitialArticles();
  return <FeedHome initialArticles={initialArticles} />;
}
