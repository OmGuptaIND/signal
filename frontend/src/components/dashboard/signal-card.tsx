"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Signal } from "@/lib/api-types";

interface SignalCardProps {
  signal: Signal;
}

const signalConfig = {
  LONG_BIAS: { label: "LONG", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", barColor: "bg-emerald-400" },
  SHORT_BIAS: { label: "SHORT", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", barColor: "bg-red-400" },
  NEUTRAL: { label: "NEUTRAL", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", barColor: "bg-amber-400" },
};

export function SignalCard({ signal }: SignalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = signalConfig[signal.signal] ?? signalConfig.NEUTRAL;
  const confidence = Number(signal.confidence);
  const confidencePercent = (confidence * 100).toFixed(0);

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 transition-colors",
        config.border,
      )}
    >
      {/* Top row: signal type + time + index */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
              config.bg,
              config.color,
            )}
          >
            {config.label}
          </span>
          <span className="text-sm font-medium">{signal.index_name}</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {new Date(signal.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      {/* Middle row: spot + confidence */}
      <div className="mt-2.5 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Spot Price</p>
          <p className="text-sm font-semibold tabular-nums">
            {Number(signal.spot_price).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Confidence</p>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted/50">
              <div
                className={cn("h-full rounded-full transition-all", config.barColor)}
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
            <span className={cn("text-sm font-semibold tabular-nums", config.color)}>
              {confidencePercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Expandable details */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{expanded ? "Less" : "Details"}</span>
        <ChevronDown
          className={cn(
            "size-3 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-border pt-2 animate-in fade-in slide-in-from-top-1">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Delta</span>
              <p className="font-mono font-medium">
                {Number(signal.total_delta).toFixed(1)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Weighted Delta</span>
              <p className="font-mono font-medium">
                {Number(signal.weighted_total_delta).toFixed(1)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">ATM Strike</span>
              <p className="font-mono font-medium">{signal.atm_strike}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Votes</span>
              <p className="font-mono font-medium">{signal.timeframe_votes}</p>
            </div>
          </div>
          {signal.reason && (
            <div className="text-xs">
              <span className="text-muted-foreground">Reason</span>
              <p className="mt-0.5 text-muted-foreground/80 leading-relaxed break-words">
                {signal.reason}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
