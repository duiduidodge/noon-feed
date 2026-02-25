# Cryptofeed Charts

Real-time crypto charts powered by [cryptofeed](https://github.com/bmoscon/cryptofeed).
Standalone app — links back to Noon Feed.

## Structure

```
cryptofeed-charts/
├── backend/    Python FastAPI + cryptofeed (Binance WebSocket feeds)
└── frontend/   Next.js charts UI (TradingView lightweight-charts)
```

## Data feeds (via Binance)

| Feed | Coins |
|---|---|
| Candlesticks (1m/5m/15m/1h/4h/1d) | BTC, ETH, SOL, XRP |
| Live trades | BTC, ETH, SOL, XRP |
| Best bid/ask | BTC, ETH, SOL, XRP |
| Funding rates | BTC, ETH, SOL, XRP (futures) |
| Liquidations | BTC, ETH, SOL, XRP (futures) |

---

## Local development

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

Test WebSocket:
```bash
# install wscat: npm i -g wscat
wscat -c ws://localhost:8080/ws/BTC
```

Test REST:
```bash
curl "http://localhost:8080/candles/BTC?tf=1h&limit=5"
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev   # → http://localhost:3010
```

---

## Deploy to Fly.io

### Backend

```bash
cd backend
fly launch --name cryptofeed-charts-api --region sin
fly deploy
```

### Frontend

```bash
cd frontend
fly launch --name cryptofeed-charts-ui --region sin
fly secrets set NEXT_PUBLIC_CHARTS_API_URL=wss://cryptofeed-charts-api.fly.dev
fly secrets set NEXT_PUBLIC_NOON_FEED_URL=https://your-noon-feed-url.com
fly deploy
```
