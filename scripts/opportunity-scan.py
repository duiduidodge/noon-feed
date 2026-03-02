#!/usr/bin/env python3
"""
Crypto Opportunity Scanner
Scans top Binance Futures markets for trading opportunities using public APIs only.
Outputs JSON matching the OpportunitySnapshot schema.

Pillars:
  - Smart Money: Top-trader long/short positioning + taker flow
  - Market Structure: EMA alignment, OI change, trend
  - Technicals: RSI, volume ratio, momentum, patterns
  - Funding: Funding rate favorability for direction

Usage: python3 opportunity-scan.py
Output: JSON to stdout
"""

import json
import sys
import os
import time
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import requests
except ImportError:
    print(json.dumps({"error": "requests library not installed. Run: pip install requests"}))
    sys.exit(1)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_URL = "https://fapi.binance.com"
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".opportunity-state.json")

MIN_VOLUME_USDT = 60_000_000   # $60M daily quote volume minimum
STAGE1_LIMIT    = 60           # candidates after volume filter
DEEP_LIMIT      = 10           # max assets for full deep-dive
TOP_OUTPUT      = 6            # max opportunities in output

REQUEST_TIMEOUT = 12           # seconds per HTTP call
MAX_CONCURRENT  = 8            # concurrent threads for deep dive

EXCLUDE_SYMBOLS = {
    "USDCUSDT", "BUSDUSDT", "TUSDUSDT", "USDTUSDT", "DAIUSDT",
    "BTCDOMUSDT", "DEFIUSDT", "ALTUSDT",
}
EXCLUDE_SUFFIXES = {"BULL", "BEAR", "UP", "DOWN", "3L", "3S", "5L", "5S"}

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

SESSION = requests.Session()
SESSION.headers.update({"Accept": "application/json"})


def get_json(url, params=None, retries=2):
    for attempt in range(retries + 1):
        try:
            r = SESSION.get(url, params=params, timeout=REQUEST_TIMEOUT)
            r.raise_for_status()
            return r.json()
        except Exception:
            if attempt < retries:
                time.sleep(0.3 * (attempt + 1))
    return None


# ---------------------------------------------------------------------------
# Technical indicators (pure Python, no dependencies)
# ---------------------------------------------------------------------------

def calculate_rsi(closes, period=14):
    if len(closes) < period + 2:
        return 50.0
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [max(d, 0.0) for d in deltas]
    losses = [max(-d, 0.0) for d in deltas]
    avg_g = sum(gains[:period]) / period
    avg_l = sum(losses[:period]) / period
    for i in range(period, len(deltas)):
        avg_g = (avg_g * (period - 1) + gains[i]) / period
        avg_l = (avg_l * (period - 1) + losses[i]) / period
    if avg_l == 0:
        return 100.0
    rs = avg_g / avg_l
    return round(100.0 - (100.0 / (1.0 + rs)), 2)


def calculate_ema(closes, period):
    if len(closes) < period:
        return closes[-1] if closes else 0.0
    k = 2.0 / (period + 1)
    ema = sum(closes[:period]) / period
    for price in closes[period:]:
        ema = price * k + ema * (1 - k)
    return ema


def calculate_atr_pct(highs, lows, closes, period=14):
    if len(closes) < 2:
        return 1.0
    trs = []
    for i in range(1, min(len(closes), period + 1)):
        tr = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1]),
        )
        trs.append(tr)
    atr = sum(trs) / len(trs) if trs else 0.0
    price = closes[-1]
    return round((atr / price) * 100, 3) if price > 0 else 1.0


def volume_ratio(vols):
    """Current candle volume vs 20-candle average (exclude last)."""
    if len(vols) < 3:
        return 1.0
    baseline = vols[:-1][-20:]
    avg = sum(baseline) / len(baseline) if baseline else 1.0
    return round(vols[-1] / avg, 2) if avg > 0 else 1.0


def detect_patterns(closes, opens, highs, lows):
    patterns = []
    if len(closes) < 5:
        return patterns
    # Higher highs / lower lows
    if highs[-1] > highs[-3] and lows[-1] > lows[-3]:
        patterns.append("higher_highs")
    elif highs[-1] < highs[-3] and lows[-1] < lows[-3]:
        patterns.append("lower_lows")
    # Consolidation (last 3 candles narrow range < 0.5%)
    ranges = [(highs[-i] - lows[-i]) / closes[-i] for i in range(1, 4) if closes[-i] > 0]
    if ranges and sum(ranges) / len(ranges) < 0.005:
        patterns.append("consolidation")
    # Engulfing
    if len(closes) >= 2:
        prev_body = abs(closes[-2] - opens[-2])
        curr_body = abs(closes[-1] - opens[-1])
        if (closes[-1] > opens[-1] and opens[-1] < closes[-2]
                and closes[-1] > opens[-2] and curr_body > prev_body):
            patterns.append("bull_engulf")
        elif (closes[-1] < opens[-1] and opens[-1] > closes[-2]
              and closes[-1] < opens[-2] and curr_body > prev_body):
            patterns.append("bear_engulf")
    return patterns


def support_resistance(highs, lows, n=20):
    rh = highs[-n:]
    rl = lows[-n:]
    return (round(min(rl), 6), round(max(rh), 6)) if rh and rl else (None, None)


# ---------------------------------------------------------------------------
# Binance API fetchers
# ---------------------------------------------------------------------------

def fetch_klines(symbol, interval, limit):
    data = get_json(f"{BASE_URL}/fapi/v1/klines",
                    params={"symbol": symbol, "interval": interval, "limit": limit})
    if not data or not isinstance(data, list):
        return None
    opens  = [float(k[1]) for k in data]
    highs  = [float(k[2]) for k in data]
    lows   = [float(k[3]) for k in data]
    closes = [float(k[4]) for k in data]
    vols   = [float(k[5]) for k in data]
    return opens, highs, lows, closes, vols


def fetch_top_long_short(symbol):
    data = get_json(f"{BASE_URL}/futures/data/topLongShortPositionRatio",
                    params={"symbol": symbol, "period": "1h", "limit": 3})
    if data and isinstance(data, list) and data:
        try:
            return float(data[-1]["longShortRatio"])
        except Exception:
            pass
    return None


def fetch_taker_ratio(symbol):
    data = get_json(f"{BASE_URL}/futures/data/takerlongshortRatio",
                    params={"symbol": symbol, "period": "1h", "limit": 3})
    if data and isinstance(data, list) and data:
        try:
            return float(data[-1]["buySellRatio"])
        except Exception:
            pass
    return None


def fetch_oi_change(symbol):
    data = get_json(f"{BASE_URL}/futures/data/openInterestHist",
                    params={"symbol": symbol, "period": "1h", "limit": 5})
    if data and isinstance(data, list) and len(data) >= 2:
        try:
            oldest = float(data[0]["sumOpenInterestValue"])
            newest = float(data[-1]["sumOpenInterestValue"])
            if oldest > 0:
                return round((newest - oldest) / oldest * 100, 2)
        except Exception:
            pass
    return None


def fetch_funding_rate(symbol):
    data = get_json(f"{BASE_URL}/fapi/v1/premiumIndex", params={"symbol": symbol})
    if data and isinstance(data, dict):
        rate = data.get("lastFundingRate")
        if rate is not None:
            try:
                return float(rate)
            except Exception:
                pass
    return None


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def score_pillars(direction, rsi_1h, rsi_15m, trend_4h, vol_r, oi_chg,
                  top_ls, taker_r, funding_rate):
    """Return (sm_score, ms_score, tech_score, funding_score, risks, favorable, annualized)."""
    risks = []

    # --- Smart Money (0-100) ---
    sm = 50
    if top_ls is not None:
        ratio = top_ls if direction == "LONG" else (1.0 / top_ls if top_ls > 0 else 1.0)
        if ratio >= 2.0:   sm = 85
        elif ratio >= 1.5: sm = 75
        elif ratio >= 1.2: sm = 65
        elif ratio >= 1.0: sm = 55
        elif ratio >= 0.8: sm = 40
        else:              sm = 30
    if taker_r is not None:
        good_taker = (direction == "LONG" and taker_r > 1.1) or (direction == "SHORT" and taker_r < 0.9)
        if good_taker:
            sm = min(100, sm + 10)

    # --- Market Structure (0-100) ---
    ms = 50
    if trend_4h == "UP":
        ms = 68 if direction == "LONG" else 35
    elif trend_4h == "DOWN":
        ms = 68 if direction == "SHORT" else 35
    if oi_chg is not None:
        if oi_chg > 5:    ms = min(100, ms + 15)
        elif oi_chg > 2:  ms = min(100, ms + 8)
        elif oi_chg < -5: ms = max(0, ms - 15)
    if vol_r and vol_r > 1.5:
        ms = min(100, ms + 8)

    # --- Technicals (0-100) ---
    tech = 50
    if rsi_1h is not None:
        if direction == "LONG":
            if 45 <= rsi_1h <= 65:   tech = 72
            elif 30 <= rsi_1h < 45:  tech = 78
            elif rsi_1h < 30:        tech = 62
            elif rsi_1h > 75:
                tech = 32
                risks.append("overbought_rsi")
            else:
                tech = 55
        else:
            if 55 <= rsi_1h <= 72:   tech = 72
            elif rsi_1h > 72:        tech = 78
            elif rsi_1h < 30:
                tech = 32
                risks.append("oversold_rsi")
            else:
                tech = 55

    if rsi_15m is not None:
        good_15m = (direction == "LONG" and 45 <= rsi_15m <= 70) or \
                   (direction == "SHORT" and 55 <= rsi_15m <= 75)
        if good_15m:
            tech = min(100, tech + 8)

    if vol_r is not None:
        if vol_r >= 2.5:   tech = min(100, tech + 15)
        elif vol_r >= 1.5: tech = min(100, tech + 8)
        elif vol_r < 0.6:
            tech = max(0, tech - 15)
            risks.append("low_volume")

    # --- Funding (0-100) ---
    fund = 50
    favorable = False
    annualized = 0.0
    if funding_rate is not None:
        annualized = round(funding_rate * 3.0 * 365.0 * 100.0, 2)
        if direction == "LONG":
            if funding_rate < -0.0002:
                fund = 90; favorable = True
            elif funding_rate < 0:
                fund = 75; favorable = True
            elif funding_rate < 0.0002:
                fund = 55
            elif funding_rate < 0.001:
                fund = 40
            else:
                fund = 25; risks.append("high_funding")
        else:
            if funding_rate > 0.0002:
                fund = 90; favorable = True
            elif funding_rate > 0:
                fund = 75; favorable = True
            elif funding_rate > -0.0002:
                fund = 55
            else:
                fund = 30

    return sm, ms, tech, fund, risks, favorable, annualized


def choose_direction(rsi_1h, trend_4h, top_ls, taker_r):
    """Vote for LONG or SHORT."""
    long_v = short_v = 0
    if trend_4h == "UP":   long_v += 2
    elif trend_4h == "DOWN": short_v += 2
    if rsi_1h:
        if rsi_1h < 40:    long_v += 1
        elif rsi_1h > 65:  short_v += 1
    if top_ls:
        if top_ls > 1.2:   long_v += 1
        elif top_ls < 0.8: short_v += 1
    if taker_r:
        if taker_r > 1.1:  long_v += 1
        elif taker_r < 0.9: short_v += 1
    return "LONG" if long_v >= short_v else "SHORT"


def recommend_leverage(atr_pct):
    if atr_pct > 3.0: return 3
    if atr_pct > 2.0: return 5
    if atr_pct > 1.0: return 8
    return 10


# ---------------------------------------------------------------------------
# State (scan streak + score delta)
# ---------------------------------------------------------------------------

def load_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


def save_state(state):
    try:
        with open(STATE_FILE, "w") as f:
            json.dump(state, f)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Per-asset deep analysis
# ---------------------------------------------------------------------------

def analyze_asset(symbol, ticker_row, prev_state):
    try:
        # Fetch klines concurrently within this asset
        with ThreadPoolExecutor(max_workers=3) as inner:
            f1h   = inner.submit(fetch_klines, symbol, "1h", 52)
            f4h   = inner.submit(fetch_klines, symbol, "4h", 30)
            f15m  = inner.submit(fetch_klines, symbol, "15m", 35)

        klines_1h  = f1h.result()
        klines_4h  = f4h.result()
        klines_15m = f15m.result()

        if not klines_1h:
            return None

        opens_1h, highs_1h, lows_1h, closes_1h, vols_1h = klines_1h

        opens_4h = highs_4h = lows_4h = closes_4h = vols_4h = None
        if klines_4h:
            opens_4h, highs_4h, lows_4h, closes_4h, vols_4h = klines_4h

        opens_15m = highs_15m = lows_15m = closes_15m = vols_15m = None
        if klines_15m:
            opens_15m, highs_15m, lows_15m, closes_15m, vols_15m = klines_15m

        # Fetch market-data signals concurrently
        with ThreadPoolExecutor(max_workers=4) as inner:
            ftls = inner.submit(fetch_top_long_short, symbol)
            ftkr = inner.submit(fetch_taker_ratio, symbol)
            foic = inner.submit(fetch_oi_change, symbol)
            ffnd = inner.submit(fetch_funding_rate, symbol)

        top_ls      = ftls.result()
        taker_r     = ftkr.result()
        oi_chg      = foic.result()
        funding_rate = ffnd.result()

        # --- Technicals ---
        rsi_1h  = calculate_rsi(closes_1h)
        rsi_15m = calculate_rsi(closes_15m) if closes_15m else None
        vol_r   = volume_ratio(vols_1h)
        vol_r_15m = volume_ratio(vols_15m) if vols_15m else None
        atr_pct = calculate_atr_pct(highs_1h, lows_1h, closes_1h)

        # 4h trend via EMA alignment
        trend_4h     = "FLAT"
        trend_strength = 50
        if closes_4h and len(closes_4h) >= 20:
            ema20 = calculate_ema(closes_4h, 20)
            ema50 = calculate_ema(closes_4h, min(50, len(closes_4h)))
            curr  = closes_4h[-1]
            if curr > ema20 > ema50:
                trend_4h = "UP"
                trend_strength = min(100, int(((curr - ema50) / ema50) * 4000))
            elif curr < ema20 < ema50:
                trend_4h = "DOWN"
                trend_strength = min(100, int(((ema50 - curr) / ema50) * 4000))

        hourly_trend = "UP" if closes_1h[-1] > closes_1h[-3] else "DOWN"

        momentum_15m = None
        if closes_15m and len(closes_15m) >= 5 and closes_15m[-5] > 0:
            momentum_15m = round((closes_15m[-1] - closes_15m[-5]) / closes_15m[-5] * 100, 2)

        chg_1h  = round((closes_1h[-1] - closes_1h[-2]) / closes_1h[-2] * 100, 2) \
                  if len(closes_1h) > 1 and closes_1h[-2] > 0 else 0.0
        chg_4h  = round((closes_1h[-1] - closes_1h[-5]) / closes_1h[-5] * 100, 2) \
                  if len(closes_1h) > 5 and closes_1h[-5] > 0 else 0.0
        chg_24h = round(float(ticker_row.get("priceChangePercent", 0)), 2)

        support, resistance = support_resistance(highs_1h, lows_1h)

        patterns_1h  = detect_patterns(closes_1h, opens_1h, highs_1h, lows_1h)
        patterns_15m = detect_patterns(closes_15m, opens_15m, highs_15m, lows_15m) \
                       if all(v is not None for v in [closes_15m, opens_15m, highs_15m, lows_15m]) else []

        # --- Direction & Scores ---
        direction = choose_direction(rsi_1h, trend_4h, top_ls, taker_r)
        sm_s, ms_s, tech_s, fund_s, risks, favorable, annualized = score_pillars(
            direction, rsi_1h, rsi_15m, trend_4h, vol_r, oi_chg,
            top_ls, taker_r, funding_rate,
        )

        trend_aligned = (direction == "LONG" and trend_4h == "UP") or \
                        (direction == "SHORT" and trend_4h == "DOWN")

        final_score  = sm_s + ms_s + tech_s + fund_s
        leverage     = recommend_leverage(atr_pct)

        # Scan streak & delta from state
        prev        = prev_state.get(symbol, {})
        prev_score  = prev.get("finalScore", final_score)
        prev_streak = prev.get("scanStreak", 0)
        scan_streak = prev_streak + 1
        score_delta = final_score - prev_score

        sm_traders = int(max(sm_s, 1) * 10)
        sm_pnl     = round((top_ls - 1.0) * 12.0, 1) if top_ls else 0.0
        sm_accel   = round(oi_chg / 10.0, 2) if oi_chg else 0.0

        return {
            # Output fields
            "asset":       symbol.replace("USDT", ""),
            "direction":   direction,
            "leverage":    leverage,
            "finalScore":  final_score,
            "scoreDelta":  score_delta,
            "scanStreak":  scan_streak,
            "hourlyTrend": hourly_trend,
            "trendAligned": trend_aligned,
            "pillarScores": {
                "smartMoney":      sm_s,
                "marketStructure": ms_s,
                "technicals":      tech_s,
                "funding":         fund_s,
            },
            "smartMoney": {
                "traders":  sm_traders,
                "pnlPct":   sm_pnl,
                "accel":    sm_accel,
                "direction": direction,
            },
            "technicals": {
                "rsi1h":        rsi_1h,
                "rsi15m":       rsi_15m,
                "volRatio1h":   vol_r,
                "volRatio15m":  vol_r_15m,
                "trend4h":      trend_4h,
                "trendStrength": trend_strength,
                "patterns1h":   patterns_1h,
                "patterns15m":  patterns_15m,
                "momentum15m":  momentum_15m,
                "chg1h":        chg_1h,
                "chg4h":        chg_4h,
                "chg24h":       chg_24h,
                "support":      support,
                "resistance":   resistance,
                "atrPct":       atr_pct,
            },
            "funding": {
                "rate":       round(funding_rate, 6) if funding_rate is not None else 0.0,
                "annualized": annualized,
                "favorable":  favorable,
            },
            "risks": risks,
            # Internal (stripped before output)
            "_symbol":     symbol,
            "_finalScore": final_score,
        }
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    scan_time  = datetime.now(timezone.utc)
    prev_state = load_state()

    # --- Fetch all tickers ---
    all_tickers = get_json(f"{BASE_URL}/fapi/v1/ticker/24hr")
    if not all_tickers or not isinstance(all_tickers, list):
        print(json.dumps({"error": "Failed to fetch Binance Futures tickers"}))
        sys.exit(1)

    ticker_map = {t["symbol"]: t for t in all_tickers}
    assets_scanned = len(all_tickers)

    # --- Stage 1: volume + symbol filter ---
    stage1 = []
    for t in all_tickers:
        sym = t.get("symbol", "")
        if not sym.endswith("USDT"):
            continue
        if sym in EXCLUDE_SYMBOLS:
            continue
        base = sym[:-4]
        if any(base.endswith(sfx) for sfx in EXCLUDE_SUFFIXES):
            continue
        vol = float(t.get("quoteVolume", 0))
        if vol < MIN_VOLUME_USDT:
            continue
        stage1.append((sym, vol))

    stage1.sort(key=lambda x: -x[1])
    stage1 = stage1[:STAGE1_LIMIT]
    passed_stage1 = len(stage1)

    # --- Stage 2: quick 1h RSI + volume ratio filter (parallel) ---
    def quick_check(sym_vol):
        sym, _ = sym_vol
        klines = fetch_klines(sym, "1h", 22)
        if not klines:
            return None
        _, _, _, closes, vols = klines
        rsi   = calculate_rsi(closes)
        vol_r = volume_ratio(vols)
        # Accept RSI 25-78 and not dead volume
        if 25 <= rsi <= 78 and vol_r >= 0.6:
            return (sym, rsi, vol_r, ticker_map.get(sym, {}))
        return None

    stage2 = []
    with ThreadPoolExecutor(max_workers=12) as pool:
        for result in pool.map(quick_check, stage1):
            if result is not None:
                stage2.append(result)

    passed_stage2 = len(stage2)

    # Sort: prefer assets with RSI near interesting zones + high vol ratio
    def stage2_rank(item):
        _, rsi, vol_r, _ = item
        rsi_interest = min(abs(rsi - 30), abs(rsi - 50), abs(rsi - 70))
        return vol_r * (1.0 + rsi_interest / 80.0)

    stage2.sort(key=stage2_rank, reverse=True)
    deep_targets = stage2[:DEEP_LIMIT]

    # --- Deep dive ---
    def deep(item):
        sym, _, _, ticker = item
        return analyze_asset(sym, ticker, prev_state)

    deep_results = []
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as pool:
        for res in pool.map(deep, deep_targets):
            if res is not None:
                deep_results.append(res)

    deep_dived   = len(deep_results)
    disqualified = assets_scanned - len(deep_results)

    # Rank by final score
    deep_results.sort(key=lambda x: -(x.get("finalScore") or 0))
    top_opps = deep_results[:TOP_OUTPUT]

    # Save state
    new_state = {}
    for opp in deep_results:
        sym = opp.get("_symbol")
        if sym:
            new_state[sym] = {
                "finalScore": opp["_finalScore"],
                "scanStreak": opp["scanStreak"],
            }
    save_state(new_state)

    # --- BTC context ---
    btc = ticker_map.get("BTCUSDT", {})
    btc_klines = fetch_klines("BTCUSDT", "1h", 3)
    btc_trend  = "FLAT"
    btc_chg_1h = 0.0
    if btc_klines:
        _, _, _, btc_closes, _ = btc_klines
        if len(btc_closes) >= 2 and btc_closes[-2] > 0:
            btc_trend  = "UP" if btc_closes[-1] > btc_closes[-2] else "DOWN"
            btc_chg_1h = round((btc_closes[-1] - btc_closes[-2]) / btc_closes[-2] * 100, 2)

    btc_context = {
        "price":     round(float(btc.get("lastPrice", 0)), 2),
        "trend":     btc_trend,
        "change1h":  btc_chg_1h,
        "change24h": round(float(btc.get("priceChangePercent", 0)), 2),
    }

    # Strip internal fields
    clean = [{k: v for k, v in o.items() if not k.startswith("_")} for o in top_opps]

    output = {
        "scanTime":      scan_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "assetsScanned": assets_scanned,
        "passedStage1":  passed_stage1,
        "passedStage2":  passed_stage2,
        "deepDived":     deep_dived,
        "disqualified":  disqualified,
        "btcContext":    btc_context,
        "opportunities": clean,
    }

    print(json.dumps(output, default=str))


if __name__ == "__main__":
    main()
