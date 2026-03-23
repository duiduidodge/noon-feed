"use client";

import clsx from "clsx";

export const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export function TimeframeSelector({
  selected,
  onChange,
}: {
  selected: Timeframe;
  onChange: (tf: Timeframe) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full border border-border/35 bg-card/42 p-1">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          className={clsx(
            "rounded-full px-3 py-2 text-[12px] font-mono font-bold tracking-[0.04em] transition-all",
            selected === tf
              ? "bg-primary/20 text-primary"
              : "text-foreground/62 hover:bg-surface hover:text-foreground/88"
          )}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}
