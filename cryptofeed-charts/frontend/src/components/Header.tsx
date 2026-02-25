"use client";

import { ArrowLeft, Activity } from "lucide-react";

const NOON_FEED_URL = process.env.NEXT_PUBLIC_NOON_FEED_URL ?? "http://localhost:3002";

export function Header() {
  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-border/40 bg-surface/40 backdrop-blur-xl shrink-0">
      <a
        href={NOON_FEED_URL}
        className="flex items-center gap-1.5 text-xs font-mono text-foreground/40 hover:text-primary transition-colors group"
      >
        <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
        Noon Feed
      </a>

      <div className="flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-primary" />
        <span className="text-sm font-display font-semibold tracking-tight text-foreground">
          Charts
        </span>
      </div>

      <div className="w-20" />
    </header>
  );
}
