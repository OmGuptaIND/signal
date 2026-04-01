"use client";

import { cn } from "@/lib/utils";
import type { ActiveRun, Signal } from "@/lib/api-types";
import { SignalCard } from "./signal-card";

interface ResponsiveSignalViewProps {
  signals: Signal[];
  maxItems?: number;
  run?: ActiveRun;
}

const signalConfig = {
  LONG_BIAS: { label: "LONG", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  SHORT_BIAS: { label: "SHORT", color: "text-red-400", bg: "bg-red-500/10" },
  NEUTRAL: { label: "NEUTRAL", color: "text-amber-400", bg: "bg-amber-500/10" },
};

export function ResponsiveSignalView({
  signals,
  maxItems,
  run,
}: ResponsiveSignalViewProps) {
  const items = maxItems ? signals.slice(0, maxItems) : signals;

  if (items.length === 0) {
    const isRunning = run?.status === "running" || run?.status === "starting";
    const isError = run?.status === "error";
    const isExpired = run?.status === "expired";

    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">
          {isError
            ? "Strategy stopped due to an error"
            : isExpired
              ? "Session expired"
              : isRunning
                ? "Collecting market data..."
                : "No signals yet"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60 max-w-sm">
          {isError
            ? run.error_message ?? "Check the Details tab for more information."
            : isExpired
              ? "Reconnect via Kite to resume. Tokens expire at end of each trading day."
              : isRunning
                ? "No conditions have triggered yet. Signals appear when market data matches the strategy's criteria."
                : "Start the strategy to begin receiving signals."}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Signal cards */}
      <div className="space-y-2 md:hidden">
        {items.map((signal) => (
          <SignalCard key={`${signal.id}-${signal.timestamp}`} signal={signal} />
        ))}
      </div>

      {/* Desktop: Table view */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">
                Time
              </th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">
                Index
              </th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">
                Signal
              </th>
              <th className="h-10 px-4 text-right text-xs font-medium text-muted-foreground">
                Spot Price
              </th>
              <th className="h-10 px-4 text-right text-xs font-medium text-muted-foreground">
                Confidence
              </th>
              <th className="h-10 px-4 text-right text-xs font-medium text-muted-foreground">
                Delta
              </th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">
                Reason
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((signal) => {
              const config =
                signalConfig[signal.signal] ?? signalConfig.NEUTRAL;
              const confidence = Number(signal.confidence);

              return (
                <tr
                  key={`${signal.id}-${signal.timestamp}`}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/50"
                >
                  <td className="h-11 px-4 font-mono text-xs text-muted-foreground">
                    {new Date(signal.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="h-11 px-4 text-sm font-medium">
                    {signal.index_name}
                  </td>
                  <td className="h-11 px-4">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-bold uppercase",
                        config.bg,
                        config.color,
                      )}
                    >
                      {config.label}
                    </span>
                  </td>
                  <td className="h-11 px-4 text-right font-mono text-xs text-muted-foreground">
                    {Number(signal.spot_price).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="h-11 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted/50">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            confidence >= 0.7
                              ? "bg-emerald-400"
                              : confidence >= 0.4
                                ? "bg-amber-400"
                                : "bg-red-400",
                          )}
                          style={{ width: `${confidence * 100}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-mono text-xs tabular-nums">
                        {(confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="h-11 px-4 text-right font-mono text-xs text-muted-foreground">
                    {Number(signal.weighted_total_delta).toFixed(1)}
                  </td>
                  <td
                    className="h-11 px-4 max-w-[200px] truncate text-xs text-muted-foreground/60"
                    title={signal.reason}
                  >
                    {signal.reason}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
