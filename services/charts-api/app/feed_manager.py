"""
cryptofeed FeedHandler setup.
Subscribes to Binance spot + BinanceFutures and populates the in-memory store.
Notifies registered WebSocket broadcasters via asyncio.Queue per coin.
"""
import asyncio
import logging
from typing import Dict, Set

from cryptofeed import FeedHandler
from cryptofeed.defines import (
    CANDLES,
    FUNDING,
    L2_BOOK,
    LIQUIDATIONS,
    OPEN_INTEREST,
    TRADES,
)
from cryptofeed.exchanges import Binance, BinanceFutures

from .store import (
    COINS,
    CandleBar,
    LiquidationEvent,
    Trade,
    store,
)

logger = logging.getLogger(__name__)

SPOT_SYMBOLS = {coin: f"{coin}-USDT" for coin in COINS}
FUTURES_SYMBOLS = {coin: f"{coin}-USDT-PERP" for coin in COINS}

_queues: Dict[str, Set[asyncio.Queue]] = {coin: set() for coin in COINS}


def subscribe(coin: str, queue: asyncio.Queue):
    _queues[coin].add(queue)


def unsubscribe(coin: str, queue: asyncio.Queue):
    _queues[coin].discard(queue)


async def _broadcast(coin: str, msg: dict):
    dead = set()
    for queue in _queues[coin]:
        try:
            queue.put_nowait(msg)
        except asyncio.QueueFull:
            dead.add(queue)
    for queue in dead:
        _queues[coin].discard(queue)


def _symbol_to_coin(symbol: str) -> str:
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

    item = Trade(
        price=float(trade.price),
        size=float(trade.amount),
        side=trade.side.value if hasattr(trade.side, "value") else str(trade.side),
        time=int(trade.timestamp * 1000),
    )
    store[coin].trades.append(item)
    await _broadcast(coin, {"type": "trade", "data": item.to_dict()})


async def book_cb(book, receipt_timestamp):
    coin = _symbol_to_coin(book.symbol)
    if coin not in store:
        return

    bid = float(max(book.book.bids)) if book.book.bids else 0.0
    ask = float(min(book.book.asks)) if book.book.asks else 0.0
    snapshot = store[coin].book
    snapshot.bid = bid
    snapshot.ask = ask
    await _broadcast(coin, {"type": "book", "data": snapshot.to_dict()})


async def funding_cb(funding, receipt_timestamp):
    coin = _symbol_to_coin(funding.symbol)
    if coin not in store:
        return

    data = store[coin].funding
    data.rate = float(funding.rate) if funding.rate else 0.0
    data.next_funding_time = int(funding.next_funding_time * 1000) if funding.next_funding_time else 0
    await _broadcast(coin, {"type": "funding", "data": data.to_dict()})


async def oi_cb(oi, receipt_timestamp):
    coin = _symbol_to_coin(oi.symbol)
    if coin not in store:
        return

    data = store[coin].open_interest
    data.open_interest = float(oi.open_interest) if oi.open_interest else 0.0
    data.timestamp = int(oi.timestamp * 1000) if oi.timestamp else 0
    await _broadcast(coin, {"type": "oi", "data": data.to_dict()})


async def liquidation_cb(liquidation, receipt_timestamp):
    coin = _symbol_to_coin(liquidation.symbol)
    if coin not in store:
        return

    event = LiquidationEvent(
        side=liquidation.side.value if hasattr(liquidation.side, "value") else str(liquidation.side),
        size=float(liquidation.quantity),
        price=float(liquidation.price),
        time=int(liquidation.timestamp * 1000),
    )
    store[coin].liquidations.append(event)
    await _broadcast(coin, {"type": "liquidation", "data": event.to_dict()})


def build_feed_handler() -> FeedHandler:
    handler = FeedHandler()

    spot_symbols = list(SPOT_SYMBOLS.values())
    futures_symbols = list(FUTURES_SYMBOLS.values())

    try:
        handler.add_feed(
            Binance(
                subscription={
                    CANDLES: spot_symbols,
                    TRADES: spot_symbols,
                    L2_BOOK: spot_symbols,
                },
                callbacks={
                    CANDLES: candle_cb,
                    TRADES: trade_cb,
                    L2_BOOK: book_cb,
                },
            )
        )
    except Exception as exc:
        logger.error("Failed to add Binance spot feed: %s", exc)

    try:
        handler.add_feed(
            BinanceFutures(
                subscription={
                    FUNDING: futures_symbols,
                    LIQUIDATIONS: futures_symbols,
                    OPEN_INTEREST: futures_symbols,
                },
                callbacks={
                    FUNDING: funding_cb,
                    LIQUIDATIONS: liquidation_cb,
                    OPEN_INTEREST: oi_cb,
                },
            )
        )
    except Exception as exc:
        logger.error("Failed to add BinanceFutures feed: %s", exc)

    return handler


def _run_feed_sync(handler) -> None:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        handler.run(install_signal_handlers=False)
    except TypeError:
        loop.add_signal_handler = lambda *args, **kwargs: None  # type: ignore[method-assign]
        try:
            handler.run()
        except Exception as exc:
            logger.error("FeedHandler exited with error: %s", exc)
    except Exception as exc:
        logger.error("FeedHandler exited with error: %s", exc)
    finally:
        loop.close()


async def run_feed():
    try:
        handler = build_feed_handler()
    except Exception as exc:
        logger.error("Failed to build FeedHandler: %s", exc)
        return

    logger.info("Starting Noon Hub charts FeedHandler...")
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, _run_feed_sync, handler)
    except Exception as exc:
        logger.error("FeedHandler executor error: %s", exc)
