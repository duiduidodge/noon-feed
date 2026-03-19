# Noon Hub Bot Contract

External bot repos should integrate with Noon Hub over HTTP instead of being moved into this repo.

Base paths:
- API service: `/hub/*`
- Optional auth header: `x-noon-hub-key: <NOON_HUB_INGEST_KEY>`

## 1. Register Bot

`POST /hub/bots/register`

```json
{
  "slug": "hyperliquid-swing",
  "name": "Hyperliquid Swing",
  "environment": "production",
  "category": "swing",
  "strategyFamily": "smc",
  "venue": "hyperliquid",
  "repoUrl": "https://github.com/your-org/hyperliquid-swing",
  "dashboardUrl": "https://trader.example.com"
}
```

## 2. Heartbeat

`POST /hub/heartbeat`

```json
{
  "botSlug": "hyperliquid-swing",
  "name": "Hyperliquid Swing",
  "status": "RUNNING",
  "message": "Polling market state",
  "version": "2026.03.19",
  "latencyMs": 412,
  "uptimeSec": 86400,
  "observedAt": "2026-03-19T10:30:00.000Z"
}
```

## 3. Metrics

`POST /hub/metrics`

```json
{
  "botSlug": "hyperliquid-swing",
  "name": "Hyperliquid Swing",
  "equityUsd": 12453.44,
  "cashUsd": 8121.22,
  "dailyPnlUsd": 143.88,
  "realizedPnlUsd": 934.11,
  "unrealizedPnlUsd": 18.74,
  "drawdownPct": 2.8,
  "winRatePct": 56.4,
  "openPositions": 2,
  "observedAt": "2026-03-19T10:30:00.000Z"
}
```

## 4. Positions

`POST /hub/positions`

```json
{
  "botSlug": "hyperliquid-swing",
  "name": "Hyperliquid Swing",
  "snapshotTime": "2026-03-19T10:30:00.000Z",
  "positions": [
    {
      "symbol": "BTC",
      "side": "LONG",
      "status": "OPEN",
      "quantity": 0.11,
      "entryPrice": 84215.5,
      "markPrice": 84620.1,
      "pnlUsd": 44.51,
      "pnlPct": 0.48,
      "openedAt": "2026-03-19T08:10:00.000Z"
    }
  ]
}
```

## 5. Events

`POST /hub/events`

```json
{
  "botSlug": "hyperliquid-swing",
  "name": "Hyperliquid Swing",
  "eventType": "fill",
  "severity": "INFO",
  "title": "TP1 filled on BTC",
  "body": "First target hit and stop moved to breakeven.",
  "symbol": "BTC",
  "eventAt": "2026-03-19T10:31:00.000Z"
}
```

Recommended status values:
- `RUNNING`
- `HEALTHY`
- `DEGRADED`
- `HALTED`
- `ERROR`

Recommended severity values:
- `INFO`
- `WARN`
- `ERROR`
