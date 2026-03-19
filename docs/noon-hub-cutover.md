# Noon Hub Cutover

This is the practical rollout path from the old Noon Feed setup to the new Noon Hub setup.

## 1. Database

Run the new migration so the hub tables exist:

```bash
npm run db:generate
npm run db:migrate
```

New tables:
- `BotAgent`
- `BotHeartbeat`
- `BotMetricSnapshot`
- `BotPositionSnapshot`
- `BotEvent`

## 2. API

Set:
- `NOON_HUB_INGEST_KEY`

Deploy the API app so external bot repos can ingest into:
- `/hub/bots/register`
- `/hub/heartbeat`
- `/hub/metrics`
- `/hub/positions`
- `/hub/events`

## 3. Charts

Deploy the charts service from this repo:

```bash
fly launch --name noon-hub-charts-api --region sin --no-deploy
./scripts/deploy-charts-fly.sh
```

Then set on the web app:

```bash
NEXT_PUBLIC_CHARTS_API_URL=wss://noon-hub-charts-api.fly.dev
```

Do not turn off `cryptofeed-charts-api` until the new web app is confirmed to stream correctly.

## 4. Web

Deploy `apps/feed` as the Noon Hub web surface.

Homepage:
- `/` = hub command center

Editorial module:
- `/feed`

Existing signals/charts/news routes remain available.

## 5. External Bot Repos

For each bot repo:

1. Register the bot once with `/hub/bots/register`
2. Send heartbeat updates on a timer
3. Send metrics snapshots on each portfolio update
4. Send positions snapshots whenever open positions change
5. Send events for fills, warnings, and failures

Reference payloads are in:
- [docs/noon-hub-bot-contract.md](/Users/dodge/Desktop/Vibe%20Code%20Project/Content%20Creator%20Bot/crypto-news-bot/docs/noon-hub-bot-contract.md)

## 6. Retirement Order

Safe retirement order:

1. Deploy Noon Hub API
2. Deploy Noon Hub charts API
3. Deploy Noon Hub web
4. Point bots to Noon Hub ingest
5. Verify bot fleet appears on `/`
6. Verify charts stream from the new charts API
7. Only then retire old chart deployment aliases or old worker responsibilities
