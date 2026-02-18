# Crypto News Bot

A production-ready system that fetches, processes, and distributes crypto news with AI-powered Thai translations and summaries.

## Features

- **Multi-source RSS Ingestion**: Fetches news from 8+ crypto news sources
- **AI-Powered Processing**: Translates and summarizes articles to Thai using OpenAI or Anthropic
- **Smart Deduplication**: URL normalization + title similarity detection
- **Discord Integration**: Posts formatted news to channels with automatic routing by topic
- **Telegram Integration**: Optional alert hub for high-impact news and bi-daily summaries
- **Breaking News Mode**: Rule-based urgent alerts using keywords + impact thresholds (no extra LLM calls)
- **Duplicate Story Clustering**: URL/title similarity clustering for cross-source duplicate detection
- **Reliability Console**: Operational health view for stale sources, failed jobs, and delivery success
- **Web Dashboard**: Browse, search, filter, and export articles
- **Social Content Generation**: Creates Thai social hooks and thread drafts
- **Export Capabilities**: CSV and JSON export for repurposing content

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   RSS/API   │ ──▶ │   Worker    │ ──▶ │  Database   │
│   Sources   │     │  (BullMQ)   │     │ (PostgreSQL)│
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           ▼                   │
                    ┌─────────────┐            │
                    │  LLM API    │            │
                    │(OpenAI/Ant) │            │
                    └─────────────┘            │
                                               │
      ┌────────────────────────────────────────┼────────────────┐
      │                                        │                │
      ▼                                        ▼                ▼
┌─────────────┐                         ┌─────────────┐  ┌─────────────┐
│  Discord    │                         │   Fastify   │  │   Next.js   │
│    Bot      │                         │    API      │  │  Dashboard  │
└─────────────┘                         └─────────────┘  └─────────────┘
```

## Tech Stack

- **Backend/API**: Node.js + TypeScript + Fastify
- **Worker/Scheduler**: BullMQ + Redis
- **Database**: PostgreSQL with Prisma ORM
- **Dashboard**: Next.js 14 (App Router) + Tailwind CSS
- **Discord**: discord.js v14
- **LLM**: OpenAI GPT-4 / Anthropic Claude (configurable)

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Discord Bot Token (from Discord Developer Portal)
- OpenAI API Key or Anthropic API Key

## Quick Start

### 1. Clone and Install

```bash
cd crypto-news-bot
cp .env.example .env
# Edit .env with your credentials
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker-compose up -d
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed default sources
npm run db:seed
```

### 5. Deploy Discord Commands

```bash
npm run --workspace=@crypto-news/bot deploy-commands
```

### 6. Start Development

```bash
# Start all services
npm run dev

# Or start individually:
npm run dev --workspace=@crypto-news/api      # API on :3001
npm run dev --workspace=@crypto-news/worker   # Worker
npm run dev --workspace=@crypto-news/bot      # Discord bot
npm run dev --workspace=@crypto-news/dashboard # Dashboard on :3000
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crypto_news?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# Discord
DISCORD_BOT_TOKEN="your-discord-bot-token"
DISCORD_GUILD_ID="your-guild-id"
DISCORD_DEFAULT_CHANNEL_ID="your-default-channel-id"
DISCORD_WEBHOOK_URL="your-discord-webhook-url"

# Optional: Channel routing by topic
DISCORD_CHANNEL_MARKET="channel-id-for-market-news"
DISCORD_CHANNEL_MACRO="channel-id-for-macro-news"
DISCORD_CHANNEL_DEFI="channel-id-for-defi-news"
DISCORD_CHANNEL_POLICY="channel-id-for-regulation-news"

# Telegram (optional additional notification hub)
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
TELEGRAM_CHAT_ID="your-telegram-chat-id"

# LLM Provider (openai or anthropic)
LLM_PROVIDER="openai"
OPENAI_API_KEY="your-openai-api-key"
# OR
ANTHROPIC_API_KEY="your-anthropic-api-key"
LLM_MODEL="gpt-4-turbo-preview"  # or claude-3-sonnet-20240229

# Fetching
FETCH_USER_AGENT="CryptoNewsBot/1.0"
FETCH_TIMEOUT_MS="30000"

# Dashboard
DASHBOARD_AUTH_SECRET="your-secret-key"

# Worker
WORKER_CONCURRENCY="3"
FETCH_INTERVAL_MINUTES="5"
ENABLE_BREAKING_NEWS_MODE="false"
BREAKING_NEWS_ALLOW_MEDIUM_IMPACT="true"
BREAKING_NEWS_MIN_IMPACT_SCORE="0.75"
BREAKING_NEWS_MIN_KEYWORD_MATCHES="1"
RELIABILITY_STALE_SOURCE_HOURS="12"

# Logging
LOG_LEVEL="info"
NODE_ENV="development"
```

## Project Structure

```
crypto-news-bot/
├── apps/
│   ├── api/           # Fastify REST API
│   ├── worker/        # RSS fetching, article processing, LLM enrichment
│   ├── dashboard/     # Next.js web dashboard
│   └── bot/           # Discord bot
├── packages/
│   └── shared/        # Types, schemas, config, utilities
├── prisma/
│   ├── schema.prisma  # Database schema
│   └── seed.ts        # Seed script
├── docker-compose.yml
└── package.json
```

## API Endpoints

### Health & Info
- `GET /health` - Health check

### Sources
- `GET /sources` - List all sources
- `POST /sources` - Add new RSS source
- `PATCH /sources/:id` - Update source
- `DELETE /sources/:id` - Delete source

### Articles
- `GET /articles` - List articles (with pagination & filters)
- `GET /articles/:id` - Get article details
- `POST /articles/:id/post` - Queue article for Discord posting
- `GET /articles/stats` - Get statistics

### Ingestion
- `POST /ingest/url` - Manual URL ingestion
- `POST /ingest/run` - Trigger RSS fetch
- `GET /ingest/status` - Get ingestion status

### Export
- `GET /export.csv` - Export articles as CSV
- `GET /export.json` - Export articles as JSON

### Reliability
- `GET /reliability/health` - Pipeline and delivery health metrics
- `GET /reliability/duplicate-clusters` - Duplicate story clusters by URL/title similarity

## Discord Commands

- `/news latest [tag] [limit]` - Get latest news
- `/news post <articleId>` - Post article to channel
- `/news sources` - List all sources
- `/news stats` - Show statistics

## Dashboard Features

### Articles Page
- Filter by source, status, sentiment, market impact, tags
- Search by title (Thai + English)
- View article details with Thai summary
- Manual Discord posting
- Copy thread drafts for X/Twitter

### Analytics Page
- Sentiment distribution
- Market impact breakdown
- Top sources
- Top tags

### Export Page
- Filter by date range, sentiment, impact, tags
- Export as CSV or JSON

## Adding New RSS Sources

### Via Dashboard
Navigate to Sources page and add a new RSS feed URL.

### Via API
```bash
curl -X POST http://localhost:3001/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Source",
    "type": "RSS",
    "url": "https://example.com/feed.xml",
    "enabled": true,
    "category": "general"
  }'
```

### Via Seed Script
Edit `prisma/seed.ts` and add your source:
```typescript
{
  name: 'Your Source',
  type: SourceType.RSS,
  url: 'https://your-source.com/rss',
  category: 'general',
  enabled: true,
}
```

## Channel Routing Configuration

The bot routes articles to channels based on tags. Configure in `.env`:

```env
DISCORD_CHANNEL_MARKET=123456789    # BTC, ETH, Altcoin
DISCORD_CHANNEL_MACRO=123456789     # Macro, ETF
DISCORD_CHANNEL_DEFI=123456789      # DeFi, L2, Bridge
DISCORD_CHANNEL_POLICY=123456789    # Regulation
DISCORD_DEFAULT_CHANNEL_ID=123456789 # Fallback
```

## Tag Vocabulary

The system uses these predefined tags:
- **Markets**: BTC, ETH, Altcoin, Solana, Exchange
- **DeFi**: DeFi, L2, Bridge, Stablecoin
- **Ecosystem**: NFT, Gaming, DAO, AI
- **Finance**: ETF, Macro, Regulation
- **Events**: Hack, Airdrop, Mining

Custom tags can be added by the LLM during enrichment.

## LLM Output Schema

The enrichment process produces:
```json
{
  "title_th": "Thai headline (max 90 chars)",
  "summary_th": "Thai summary (3-5 sentences)",
  "tags": ["BTC", "ETF"],
  "sentiment": "bullish|bearish|neutral",
  "market_impact": "high|medium|low",
  "cautions": ["Uncertainty 1"],
  "must_quote": ["Important quote"]
}
```

## Running Tests

```bash
# Run all tests
npm run test

# Run tests for shared package
npm run test --workspace=@crypto-news/shared
```

## Production Deployment

### Build
```bash
npm run build
```

### Serverless Scheduler (No Local Docker)
If you want feed ingestion + bi-daily summaries without running Redis/worker locally:

1. Deploy your database and Redis as managed services.
2. Add GitHub Actions secrets:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `REDIS_URL`
   - `DISCORD_WEBHOOK_URL`
   - `LLM_PROVIDER`
   - `LLM_MODEL`
   - one key based on provider: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY`
3. Use included workflows:
   - `.github/workflows/ingest-scheduler.yml` (every 15 minutes)
   - `.github/workflows/summary-scheduler.yml` (00:00 and 12:00 UTC = 07:00 and 19:00 Bangkok)

Worker one-shot commands used by workflows:
```bash
npm run ingest:once --workspace=@crypto-news/worker
npm run summary:once --workspace=@crypto-news/worker
```

### Run with PM2
```bash
pm2 start apps/api/dist/index.js --name crypto-api
pm2 start apps/worker/dist/index.js --name crypto-worker
pm2 start apps/bot/dist/index.js --name crypto-bot
```

### Dashboard (Vercel/Node)
The dashboard can be deployed to Vercel or run as a Node.js server:
```bash
cd apps/dashboard
npm run build
npm run start
```

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker-compose ps

# View logs
docker-compose logs postgres
```

### Redis Connection Issues
```bash
docker-compose logs redis
```

### LLM Rate Limits
The worker includes retry logic with exponential backoff. Adjust `WORKER_CONCURRENCY` if hitting limits.

### Discord Rate Limits
The bot posts sequentially with delays. Adjust in `apps/bot/src/index.ts` if needed.

## How to Extend

### Add New Tags
1. Edit `packages/shared/src/schemas/index.ts` - add to `TAG_VOCABULARY`
2. Edit `packages/shared/src/config/index.ts` - add keywords to `TOPIC_KEYWORDS`

### Add New Channels
1. Add channel ID to `.env`
2. Update `DEFAULT_CHANNEL_ROUTING` in `packages/shared/src/config/index.ts`

### Switch LLM Provider
1. Change `LLM_PROVIDER` in `.env`
2. Add corresponding API key
3. Update `LLM_MODEL` if needed

### Add API Sources
1. Create new fetcher in `apps/worker/src/services/`
2. Add source type to schema
3. Create job handler

## License

MIT

## Support

For issues and questions, please open a GitHub issue.
