"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ArrowDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveRun, Evaluation, Signal, SignalDirection } from "@/lib/api-types";

interface LiveFeedProps {
  evaluations: Evaluation[];
  filterIndex: string | null;
  filterDirection: SignalDirection | null;
  run?: ActiveRun;
}

const FALLBACK_CFG = { label: "NEUTRAL", color: "text-zinc-400", bg: "bg-zinc-500/15" } as const;

const signalConfig: Record<string, { label: string; color: string; bg: string }> = {
  LONG_BIAS: { label: "LONG", color: "text-emerald-400", bg: "bg-emerald-500/20" },
  SHORT_BIAS: { label: "SHORT", color: "text-red-400", bg: "bg-red-500/20" },
  NEUTRAL: { label: "NEUTRAL", color: "text-zinc-400", bg: "bg-zinc-500/15" },
};

function formatVotes(votes: Record<string, number>): string {
  return ["1m", "3m", "5m"]
    .map((tf) => {
      const v = votes[tf];
      if (v === undefined) return null;
      return `${tf}:${v > 0 ? "+" : v < 0 ? "-" : "0"}`;
    })
    .filter(Boolean)
    .join("  ");
}

function parseKeyMetrics(reason: string): string {
  const parsed: string[] = [];
  for (const part of reason.split(";")) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (["weighted_score", "consensus", "momentum", "pcr"].includes(key)) {
        parsed.push(`${key}=${val}`);
      }
    }
  }
  return parsed.length > 0 ? parsed.join(", ") : reason;
}

export function LiveFeedTable({
  evaluations,
  filterIndex,
  filterDirection,
  run,
}: LiveFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const prevCountRef = useRef(evaluations.length);

  // Filter evaluations
  const filtered = evaluations.filter((ev) => {
    if (filterIndex && ev.index_name !== filterIndex) return false;
    if (filterDirection && ev.signal !== filterDirection) return false;
    return true;
  });

  // Reverse so newest is at bottom (spreadsheet style)
  const rows = [...filtered].reverse();

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setIsAtBottom(atBottom);
  }, []);

  // Auto-scroll to bottom when new data arrives and user is at bottom
  useEffect(() => {
    if (evaluations.length > prevCountRef.current && isAtBottom) {
      const el = scrollRef.current;
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    }
    prevCountRef.current = evaluations.length;
  }, [evaluations.length, isAtBottom]);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  };

  const isRunning = run?.status === "running" || run?.status === "starting";

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {run?.status === "error"
            ? "Strategy stopped due to an error"
            : run?.status === "expired"
              ? "Session expired"
              : isRunning
                ? "Waiting for evaluations..."
                : "No data yet"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60 max-w-sm">
          {run?.status === "error"
            ? (run.error_message ?? "Check Details for more info.")
            : run?.status === "expired"
              ? "Reconnect via Kite to resume."
              : isRunning
                ? "Rows will appear as market data is evaluated each minute."
                : "Start the strategy to begin receiving live evaluations."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col">
      {/* Spreadsheet table */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-auto max-h-[calc(100vh-260px)] min-h-[300px]"
      >
        <table className="w-full border-collapse text-[13px] font-mono">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#111] border-b-2 border-border">
              <th className="h-8 px-2 text-right text-[10px] font-medium text-muted-foreground/50 w-10">#</th>
              <th className="h-8 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
              <th className="h-8 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Index</th>
              <th className="h-8 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Signal</th>
              <th className="h-8 px-3 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Spot</th>
              <th className="h-8 px-3 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Conf</th>
              <th className="h-8 px-3 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Delta</th>
              <th className="h-8 px-3 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">ATM</th>
              <th className="h-8 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Votes</th>
              <th className="h-8 px-3 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-10">
                <Zap className="size-3 inline" />
              </th>
              <th className="h-8 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider min-w-[180px]">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ev, i) => {
              const cfg = signalConfig[ev.signal] ?? FALLBACK_CFG;
              const confidence = Number(ev.confidence);
              const delta = Number(ev.weighted_total_delta);

              return (
                <tr
                  key={`${ev.timestamp}-${ev.index_name}-${i}`}
                  className={cn(
                    "border-b border-border/50 transition-colors",
                    ev.was_emitted
                      ? "bg-emerald-500/[0.04] border-l-2 border-l-emerald-500"
                      : i % 2 === 0
                        ? "bg-transparent"
                        : "bg-white/[0.01]",
                    "hover:bg-white/[0.04]",
                  )}
                >
                  {/* Row number */}
                  <td className="h-8 px-2 text-right text-[10px] text-muted-foreground/30 select-none">
                    {i + 1}
                  </td>

                  {/* Time */}
                  <td className="h-8 px-3 text-[12px] text-muted-foreground whitespace-nowrap">
                    {new Date(ev.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>

                  {/* Index */}
                  <td className="h-8 px-3 text-[12px] font-sans font-medium whitespace-nowrap">
                    {ev.index_name}
                  </td>

                  {/* Signal */}
                  <td className="h-8 px-3">
                    <span
                      className={cn(
                        "inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none",
                        cfg.bg,
                        cfg.color,
                      )}
                    >
                      {cfg.label}
                    </span>
                  </td>

                  {/* Spot Price */}
                  <td className="h-8 px-3 text-right text-[12px] text-muted-foreground tabular-nums whitespace-nowrap">
                    {Number(ev.spot_price).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  {/* Confidence */}
                  <td className="h-8 px-3 text-right whitespace-nowrap">
                    <span
                      className={cn(
                        "text-[12px] tabular-nums",
                        confidence >= 0.7
                          ? "text-emerald-400"
                          : confidence >= 0.4
                            ? "text-amber-400"
                            : "text-zinc-500",
                      )}
                    >
                      {(confidence * 100).toFixed(0)}%
                    </span>
                  </td>

                  {/* Delta */}
                  <td className="h-8 px-3 text-right whitespace-nowrap">
                    <span
                      className={cn(
                        "text-[12px] tabular-nums",
                        delta > 0
                          ? "text-emerald-400"
                          : delta < 0
                            ? "text-red-400"
                            : "text-zinc-500",
                      )}
                    >
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                    </span>
                  </td>

                  {/* ATM Strike */}
                  <td className="h-8 px-3 text-right text-[12px] text-muted-foreground tabular-nums whitespace-nowrap">
                    {Number(ev.atm_strike).toLocaleString("en-IN")}
                  </td>

                  {/* Votes */}
                  <td className="h-8 px-3 text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatVotes(ev.votes)}
                  </td>

                  {/* Emitted */}
                  <td className="h-8 px-3 text-center">
                    {ev.was_emitted && (
                      <Zap className="size-3 text-emerald-400 inline" />
                    )}
                  </td>

                  {/* Reason */}
                  <td
                    className="h-8 px-3 text-[11px] text-muted-foreground/60 max-w-[250px] truncate"
                    title={ev.reason}
                  >
                    {parseKeyMetrics(ev.reason)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between border-t border-border bg-[#111] px-3 py-1.5">
        <span className="text-[10px] text-muted-foreground/50">
          {filtered.length === evaluations.length
            ? `${rows.length} rows`
            : `${rows.length} of ${evaluations.length} rows`}
        </span>
        {evaluations.filter((e) => e.was_emitted).length > 0 && (
          <span className="text-[10px] text-emerald-400/60 flex items-center gap-1">
            <Zap className="size-2.5" />
            {evaluations.filter((e) => e.was_emitted).length} emitted
          </span>
        )}
      </div>

      {/* Jump to latest button */}
      {!isAtBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-12 right-4 flex items-center gap-1.5 rounded-full bg-zinc-800 border border-border px-3 py-1.5 text-xs text-muted-foreground shadow-lg hover:bg-zinc-700 transition-colors"
        >
          <ArrowDown className="size-3" />
          Latest
        </button>
      )}
    </div>
  );
}

// Backward-compatible simple signals table for the Overview page
interface ResponsiveSignalViewProps {
  signals: Signal[];
  maxItems?: number;
  run?: ActiveRun;
}

export function ResponsiveSignalView({ signals, maxItems, run }: ResponsiveSignalViewProps) {
  const items = maxItems ? signals.slice(0, maxItems) : signals;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">No signals yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px] font-mono">
        <thead>
          <tr className="border-b-2 border-border bg-[#111]">
            <th className="h-8 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
            <th className="h-8 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Index</th>
            <th className="h-8 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Signal</th>
            <th className="h-8 px-3 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Spot</th>
            <th className="h-8 px-3 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Conf</th>
            <th className="h-8 px-3 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Delta</th>
          </tr>
        </thead>
        <tbody>
          {items.map((signal, i) => {
            const cfg = signalConfig[signal.signal] ?? FALLBACK_CFG;
            const confidence = Number(signal.confidence);
            const delta = Number(signal.weighted_total_delta);
            return (
              <tr
                key={`${signal.id}-${signal.timestamp}`}
                className={cn(
                  "border-b border-border/50 hover:bg-white/[0.04]",
                  i % 2 === 0 ? "bg-transparent" : "bg-white/[0.01]",
                )}
              >
                <td className="h-8 px-3 text-[12px] text-muted-foreground whitespace-nowrap">
                  {new Date(signal.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </td>
                <td className="h-8 px-3 text-[12px] font-sans font-medium">{signal.index_name}</td>
                <td className="h-8 px-3">
                  <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none", cfg.bg, cfg.color)}>
                    {cfg.label}
                  </span>
                </td>
                <td className="h-8 px-3 text-right text-[12px] text-muted-foreground tabular-nums">
                  {Number(signal.spot_price).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="h-8 px-3 text-right">
                  <span className={cn("text-[12px] tabular-nums", confidence >= 0.7 ? "text-emerald-400" : confidence >= 0.4 ? "text-amber-400" : "text-zinc-500")}>
                    {(confidence * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="h-8 px-3 text-right">
                  <span className={cn("text-[12px] tabular-nums", delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-zinc-500")}>
                    {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
