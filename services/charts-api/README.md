# Noon Hub Charts API

This service is the live charts and market-stream outlet for Noon Hub.

It provides:
- REST candle bootstrap at `/candles/{coin}?tf=1h&limit=200`
- WebSocket streaming at `/ws/{coin}`
- live trades
- best bid/ask
- funding
- open interest
- liquidations

## Local development

```bash
cd services/charts-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

## Fly deploy

```bash
fly launch --name noon-hub-charts-api --region sin --no-deploy
./scripts/deploy-charts-fly.sh
```
