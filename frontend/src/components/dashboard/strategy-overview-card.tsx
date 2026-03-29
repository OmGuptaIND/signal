"use client";

import { useAtom } from "jotai";
import { Activity, ArrowRight, BarChart3, Square, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ActiveRun, Signal } from "@/lib/api-types";

interface StrategyOverviewCardProps {
  strategyId: string;
  strategyName: string;
  signals: Signal[];
  run: ActiveRun | undefined;
  onStop: (runId: number) => void;
}

export function StrategyOverviewCard({
  strategyId,
  strategyName,
  signals,
  run,
  onStop,
}: StrategyOverviewCardProps) {
  const isRunning = run?.status === "running" || run?.status === "starting";

  const summary = useMemo(() => {
    if (signals.length === 0) {
      return { dominant: "No data", long: 0, short: 0, neutral: 0, avgConfidence: 0 };
    }
    const long = signals.filter((s) => s.signal === "LONG_BIAS").length;
    const short = signals.filter((s) => s.signal === "SHORT_BIAS").length;
    const neutral = signals.length - long - short;
    const avgConfidence =
      signals.reduce((acc, s) => acc + Number(s.confidence || 0), 0) /
      signals.length;
    const dominant =
      long >= short && long >= neutral
        ? "LONG"
        : short >= long && short >= neutral
          ? "SHORT"
          : "NEUTRAL";
    return { dominant, long, short, neutral, avgConfidence };
  }, [signals]);

  const lastSignal = signals[0];

  return (
    <Card className="group transition-colors hover:border-muted-foreground/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-lg",
              isRunning ? "bg-emerald-500/10" : "bg-muted/50",
            )}
          >
            <BarChart3
              className={cn(
                "size-4",
                isRunning ? "text-emerald-400" : "text-muted-foreground",
              )}
            />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{strategyName}</h3>
            <p className="text-xs text-muted-foreground font-mono">
              {strategyId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {run?.status && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] uppercase",
                run.status === "running"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : run.status === "starting"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : run.status === "error"
                      ? "border-red-500/30 bg-red-500/10 text-red-400"
                      : "",
              )}
            >
              {run.status}
            </Badge>
          )}
          {isRunning && run && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-400"
              onClick={(e) => {
                e.preventDefault();
                onStop(run.id);
              }}
            >
              <Square className="size-3" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        {/* Signal distribution mini bar */}
        {signals.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Signal Distribution</span>
              <span className="font-mono">{signals.length} total</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted/50">
              {summary.long > 0 && (
                <div
                  className="bg-emerald-400 transition-all"
                  style={{
                    width: `${(summary.long / signals.length) * 100}%`,
                  }}
                />
              )}
              {summary.neutral > 0 && (
                <div
                  className="bg-amber-400 transition-all"
                  style={{
                    width: `${(summary.neutral / signals.length) * 100}%`,
                  }}
                />
              )}
              {summary.short > 0 && (
                <div
                  className="bg-red-400 transition-all"
                  style={{
                    width: `${(summary.short / signals.length) * 100}%`,
                  }}
                />
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Long {summary.long}
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-amber-400" />
                Neutral {summary.neutral}
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-red-400" />
                Short {summary.short}
              </span>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Dominant</p>
            <p
              className={cn(
                "text-sm font-semibold",
                summary.dominant === "LONG"
                  ? "text-emerald-400"
                  : summary.dominant === "SHORT"
                    ? "text-red-400"
                    : "text-muted-foreground",
              )}
            >
              {summary.dominant}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Confidence</p>
            <p className="text-sm font-semibold tabular-nums">
              {(summary.avgConfidence * 100).toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Signal</p>
            <p className="text-sm font-semibold tabular-nums">
              {lastSignal
                ? new Date(lastSignal.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </p>
          </div>
        </div>

        {/* View details link */}
        <Link
          href={`/strategy/${strategyId}`}
          className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/30 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          View Dashboard
          <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
