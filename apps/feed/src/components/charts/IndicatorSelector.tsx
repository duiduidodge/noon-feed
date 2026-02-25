"use client";

export type IndicatorKey = "ma20" | "ma50" | "ma200" | "ema9" | "ema21" | "rsi14";

const INDICATORS: { key: IndicatorKey; label: string; color: string }[] = [
  { key: "ma20",  label: "MA20",  color: "#f59e0b" },
  { key: "ma50",  label: "MA50",  color: "#8b5cf6" },
  { key: "ma200", label: "MA200", color: "#3b82f6" },
  { key: "ema9",  label: "EMA9",  color: "#06b6d4" },
  { key: "ema21", label: "EMA21", color: "#f97316" },
  { key: "rsi14", label: "RSI",   color: "#d946ef" },
];

type Props = {
  active: Set<IndicatorKey>;
  toggle: (k: IndicatorKey) => void;
};

export function IndicatorSelector({ active, toggle }: Props) {
  return (
    <div className="flex items-center gap-1">
      {INDICATORS.map(({ key, label, color }) => {
        const on = active.has(key);
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border transition-all duration-150"
            style={{
              borderColor: on ? color : "rgba(255,255,255,0.08)",
              color:       on ? color : "rgba(255,255,255,0.25)",
              background:  on ? `${color}18` : "transparent",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
