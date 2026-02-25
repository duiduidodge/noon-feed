"""
cryptofeed FeedHandler setup.
Subscribes to Binance spot + BinanceFutures and populates the in-memory store.
Notifies registered WebSocket broadcasters via asyncio.Queue per coin.
"""
import asyncio
import logging
from decimal import Decimal
from typing import Callable, Dict, Set

from cryptofeed import FeedHandler
from cryptofeed.defines import (
    CANDLES,
    FUNDING,
    L1_BOOK,
    LIQUIDATIONS,
    TRADES,
)
from cryptofeed.exchanges import Binance, BinanceFutures

from .store import (
    COINS,
    CandleBar,
    FundingData,
    LiquidationEvent,
    Trade,
    store,
)

logger = logging.getLogger(__name__)

# Symbol map: internal coin → Binance symbol
SPOT_SYMBOLS = {coin: f"{coin}-USDT" for coin in COINS}
FUTURES_SYMBOLS = {coin: f"{coin}-USDT" for coin in COINS}

# Per-coin broadcast queues — ws.py subscribes to these
_queues: Dict[str, Set[asyncio.Queue]] = {coin: set() for coin in COINS}


def subscribe(coin: str, q: asyncio.Queue):
    _queues[coin].add(q)


def unsubscribe(coin: str, q: asyncio.Queue):
    _queues[coin].discard(q)


async def _broadcast(coin: str, msg: dict):
    dead = set()
    for q in _queues[coin]:
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            dead.add(q)
    for q in dead:
        _queues[coin].discard(q)


# ── Callbacks ────────────────────────────────────────────────


def _symbol_to_coin(symbol: str) -> str:
    """'BTC-USDT' → 'BTC'"""
    return symbol.split("-")[0]


async def candle_cb(candle, receipt_timestamp):
    coin = _symbol_to_coin(candle.symbol)
    if coin not in store:
        return

    bar = CandleBar(
        time=int(candle.start),
        open=float(candle.open),
        high=float(candle.high),
        low=float(candle.low),
        close=float(candle.close),
        volume=float(candle.volume),
    )
    store[coin].update_candle("1m", bar)
    await _broadcast(coin, {"type": "candle", "data": bar.to_dict()})


async def trade_cb(trade, receipt_timestamp):
    coin = _symbol_to_coin(trade.symbol)
    if coin not in store:
        return

    t = Trade(
        price=float(trade.price),
        size=float(trade.amount),
        side=trade.side,
        time=int(trade.timestamp * 1000),
    )
    store[coin].trades.append(t)
    await _broadcast(coin, {"type": "trade", "data": t.to_dict()})


async def book_cb(book, receipt_timestamp):
    coin = _symbol_to_coin(book.symbol)
    if coin not in store:
        return

    bid = float(book.book.bids.index(0)[0]) if book.book.bids else 0.0
    ask = float(book.book.asks.index(0)[0]) if book.book.asks else 0.0

    snap = store[coin].book
    snap.bid = bid
    snap.ask = ask
    await _broadcast(coin, {"type": "book", "data": snap.to_dict()})


async def funding_cb(funding, receipt_timestamp):
    coin = _symbol_to_coin(funding.symbol)
    if coin not in store:
        return

    fd = store[coin].funding
    fd.rate = float(funding.rate) if funding.rate else 0.0
    fd.next_funding_time = int(funding.next_funding_time * 1000) if funding.next_funding_time else 0
    await _broadcast(coin, {"type": "funding", "data": fd.to_dict()})


async def liquidation_cb(liquidation, receipt_timestamp):
    coin = _symbol_to_coin(liquidation.symbol)
    if coin not in store:
        return

    liq = LiquidationEvent(
        side=liquidation.side,
        size=float(liquidation.quantity),
        price=float(liquidation.price),
        time=int(liquidation.timestamp * 1000),
    )
    store[coin].liquidations.append(liq)
    await _broadcast(coin, {"type": "liquidation", "data": liq.to_dict()})


# ── FeedHandler setup ─────────────────────────────────────────


def build_feed_handler() -> FeedHandler:
    fh = FeedHandler()

    spot_symbols = list(SPOT_SYMBOLS.values())
    futures_symbols = list(FUTURES_SYMBOLS.values())

    # Binance spot: candles + trades + L1 book
    fh.add_feed(
        Binance(
            subscription={
                CANDLES: spot_symbols,
                TRADES: spot_symbols,
                L1_BOOK: spot_symbols,
            },
            callbacks={
                CANDLES: candle_cb,
                TRADES: trade_cb,
                L1_BOOK: book_cb,
            },
        )
    )

    # BinanceFutures: funding rates + liquidations
    fh.add_feed(
        BinanceFutures(
            subscription={
                FUNDING: futures_symbols,
                LIQUIDATIONS: futures_symbols,
            },
            callbacks={
                FUNDING: funding_cb,
                LIQUIDATIONS: liquidation_cb,
            },
        )
    )

    return fh


async def run_feed():
    """Start the feed handler in the background. Called from FastAPI lifespan."""
    fh = build_feed_handler()
    logger.info("Starting cryptofeed FeedHandler...")
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, fh.run)
