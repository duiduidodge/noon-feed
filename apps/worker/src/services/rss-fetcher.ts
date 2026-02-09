import Parser from 'rss-parser';
import { createLogger, retryWithBackoff } from '@crypto-news/shared';
import type { RSSItem } from '@crypto-news/shared';

const logger = createLogger('worker:rss');

// Strip CDATA wrappers from RSS field values (e.g. CoinTelegraph)
function stripCDATA(value: string): string {
  return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

export interface RSSFetchResult {
  items: RSSItem[];
  feedTitle?: string;
  feedDescription?: string;
  lastBuildDate?: string;
}

export class RSSFetcher {
  private parser: Parser;
  private userAgent: string;
  private timeoutMs: number;

  constructor(options: { userAgent: string; timeoutMs: number }) {
    this.userAgent = options.userAgent;
    this.timeoutMs = options.timeoutMs;
    this.parser = new Parser({
      timeout: this.timeoutMs,
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      customFields: {
        item: [
          ['content:encoded', 'contentEncoded'],
          ['dc:creator', 'creator'],
        ],
      },
    });
  }

  async fetch(feedUrl: string): Promise<RSSFetchResult> {
    logger.info({ feedUrl }, 'Fetching RSS feed');

    const feed = await retryWithBackoff(
      async () => {
        return await this.parser.parseURL(feedUrl);
      },
      {
        maxRetries: 3,
        baseDelayMs: 2000,
        onRetry: (error, attempt) => {
          logger.warn({ feedUrl, error: error.message, attempt }, 'Retrying RSS fetch');
        },
      }
    );

    const items: RSSItem[] = feed.items.map((item) => ({
      title: item.title || 'Untitled',
      link: stripCDATA(item.link || ''),
      pubDate: item.pubDate,
      content: (item as any).contentEncoded || item.content,
      contentSnippet: item.contentSnippet,
      guid: item.guid,
      isoDate: item.isoDate,
      creator: (item as any).creator || item.creator,
      categories: item.categories,
    }));

    logger.info({ feedUrl, itemCount: items.length }, 'RSS feed fetched');

    return {
      items,
      feedTitle: feed.title,
      feedDescription: feed.description,
      lastBuildDate: feed.lastBuildDate,
    };
  }

  // Fetch items published since a specific date
  async fetchSince(feedUrl: string, since: Date): Promise<RSSFetchResult> {
    const result = await this.fetch(feedUrl);

    const filteredItems = result.items.filter((item) => {
      if (!item.isoDate && !item.pubDate) return true; // Include if no date
      const itemDate = new Date(item.isoDate || item.pubDate!);
      return itemDate > since;
    });

    return {
      ...result,
      items: filteredItems,
    };
  }
}
