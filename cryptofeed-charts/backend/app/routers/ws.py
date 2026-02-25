"""
WebSocket endpoint: /ws/{coin}
Streams real-time cryptofeed data to connected clients.
Also serves a REST endpoint for historical candle seed data.
"""
import asyncio
import json
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from ..feed_manager import subscribe, unsubscribe
from ..store import COINS, TIMEFRAME_SECONDS, store

logger = logging.getLogger(__name__)
router = APIRouter()

# Binance REST base for historical candles
BINANCE_REST = "https://api.binance.com/api/v3/klines"

TIMEFRAME_BINANCE = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
}


@router.get("/candles/{coin}")
async def get_candles(
    coin: str,
    tf: str = Query(default="1h"),
    limit: int = Query(default=200, le=500),
):
    coin = coin.upper()
    if coin not in COINS:
        return JSONResponse({"error": "unknown coin"}, status_code=400)
    if tf not in TIMEFRAME_SECONDS:
        return JSONResponse({"error": "unknown timeframe"}, status_code=400)

    # Return from memory if we have enough candles
    cached = store[coin].get_candles(tf)
    if len(cached) >= limit:
        return JSONResponse(cached[-limit:])

    # Fetch from Binance REST
    symbol = f"{coin}USDT"
    binance_tf = TIMEFRAME_BINANCE.get(tf, "1h")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                BINANCE_REST,
                params={"symbol": symbol, "interval": binance_tf, "limit": limit},
            )
            resp.raise_for_status()
            raw = resp.json()
    except Exception as e:
        logger.error("Binance REST error for %s %s: %s", coin, tf, e)
        return JSONResponse(cached, status_code=200)

    candles = [
        {
            "time": int(k[0]) // 1000,  # ms → s for lightweight-charts
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
        }
        for k in raw
    ]
    return JSONResponse(candles)


@router.websocket("/ws/{coin}")
async def websocket_endpoint(websocket: WebSocket, coin: str):
    coin = coin.upper()
    if coin not in COINS:
        await websocket.close(code=4004)
        return

    await websocket.accept()
    logger.info("WS client connected: %s", coin)

    q: asyncio.Queue = asyncio.Queue(maxsize=200)
    subscribe(coin, q)

    # Send current snapshot immediately on connect
    snap = store[coin]
    try:
        await websocket.send_text(json.dumps({"type": "book", "data": snap.book.to_dict()}))
        await websocket.send_text(json.dumps({"type": "funding", "data": snap.funding.to_dict()}))
        recent_trades = [t.to_dict() for t in list(snap.trades)[-20:]]
        for trade in recent_trades:
            await websocket.send_text(json.dumps({"type": "trade", "data": trade}))
        recent_liqs = [l.to_dict() for l in list(snap.liquidations)[-10:]]
        for liq in recent_liqs:
            await websocket.send_text(json.dumps({"type": "liquidation", "data": liq}))
    except Exception:
        pass

    try:
        while True:
            # Wait for new data or client ping
            try:
                msg = await asyncio.wait_for(q.get(), timeout=20.0)
                await websocket.send_text(json.dumps(msg))
            except asyncio.TimeoutError:
                # Send keepalive ping
                await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        logger.info("WS client disconnected: %s", coin)
    except Exception as e:
        logger.warning("WS error for %s: %s", coin, e)
    finally:
        unsubscribe(coin, q)
