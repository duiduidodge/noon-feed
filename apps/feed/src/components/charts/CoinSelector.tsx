"use client";

import clsx from "clsx";

export const COINS = ["BTC", "ETH", "SOL", "XRP"] as const;
export type Coin = (typeof COINS)[number];

const COIN_COLORS: Record<Coin, string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  SOL: "#9945ff",
  XRP: "#346aa9",
};

export function CoinSelector({
  selected,
  onChange,
}: {
  selected: Coin;
  onChange: (c: Coin) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full border border-border/35 bg-card/42 p-1">
      {COINS.map((coin) => (
        <button
          key={coin}
          onClick={() => onChange(coin)}
          className={clsx(
            "rounded-full px-3.5 py-2 text-[12px] font-mono font-bold tracking-[0.04em] transition-all",
            selected === coin
              ? "text-background"
              : "bg-surface text-foreground/68 hover:bg-surface/80 hover:text-foreground"
          )}
          style={
            selected === coin
              ? { backgroundColor: COIN_COLORS[coin], color: "#0a0f0a" }
              : {}
          }
        >
          {coin}
        </button>
      ))}
    </div>
  );
}
