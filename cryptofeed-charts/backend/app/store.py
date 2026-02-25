"""
In-memory rolling data store for all coins and feeds.
"""
from collections import deque
from typing import Deque, Dict, Optional
import time

COINS = ["BTC", "ETH", "SOL", "XRP"]

TIMEFRAME_SECONDS = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
}

MAX_CANDLES = 500
MAX_TRADES = 100


class CandleBar:
    __slots__ = ("time", "open", "high", "low", "close", "volume")

    def __init__(self, time: int, open: float, high: float, low: float, close: float, volume: float):
        self.time = time
        self.open = open
        self.high = high
        self.low = low
        self.close = close
        self.volume = volume

    def to_dict(self) -> dict:
        return {
            "time": self.time,
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
        }


class Trade:
    __slots__ = ("price", "size", "side", "time")

    def __init__(self, price: float, size: float, side: str, time: int):
        self.price = price
        self.size = size
        self.side = side
        self.time = time

    def to_dict(self) -> dict:
        return {"price": self.price, "size": self.size, "side": self.side, "time": self.time}


class BookSnapshot:
    def __init__(self):
        self.bid: float = 0.0
        self.ask: float = 0.0

    @property
    def spread(self) -> float:
        if self.ask > 0:
            return round((self.ask - self.bid) / self.ask * 100, 4)
        return 0.0

    def to_dict(self) -> dict:
        return {"bid": self.bid, "ask": self.ask, "spread": self.spread}


class FundingData:
    def __init__(self):
        self.rate: float = 0.0
        self.next_funding_time: int = 0

    def to_dict(self) -> dict:
        return {"rate": self.rate, "next_funding_time": self.next_funding_time}


class OpenInterestData:
    def __init__(self):
        self.open_interest: float = 0.0
        self.timestamp: int = 0

    def to_dict(self) -> dict:
        return {"open_interest": self.open_interest, "timestamp": self.timestamp}


class LiquidationEvent:
    __slots__ = ("side", "size", "price", "time")

    def __init__(self, side: str, size: float, price: float, time: int):
        self.side = side
        self.size = size
        self.price = price
        self.time = time

    def to_dict(self) -> dict:
        return {"side": self.side, "size": self.size, "price": self.price, "time": self.time}


class CoinStore:
    def __init__(self):
        # candles[timeframe] -> deque of CandleBar
        self.candles: Dict[str, Deque[CandleBar]] = {
            tf: deque(maxlen=MAX_CANDLES) for tf in TIMEFRAME_SECONDS
        }
        self.trades: Deque[Trade] = deque(maxlen=MAX_TRADES)
        self.book = BookSnapshot()
        self.funding = FundingData()
        self.open_interest = OpenInterestData()
        self.liquidations: Deque[LiquidationEvent] = deque(maxlen=50)

    def update_candle(self, tf: str, bar: CandleBar):
        q = self.candles[tf]
        if q and q[-1].time == bar.time:
            q[-1] = bar  # update in-progress bar
        else:
            q.append(bar)

    def get_candles(self, tf: str) -> list:
        return [c.to_dict() for c in self.candles[tf]]


# Global store — one CoinStore per coin
store: Dict[str, CoinStore] = {coin: CoinStore() for coin in COINS}
