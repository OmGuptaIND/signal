"use client";

import { useAtom } from "jotai";
import { ArrowLeft, Activity, Square, AlertTriangle, Info, XCircle, Timer, Radio, Zap } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfidenceTimeline } from "@/components/charts/confidence-timeline";
import { IndexBreakdown } from "@/components/charts/index-breakdown";
import { SignalDistribution } from "@/components/charts/signal-distribution";
import { LiveFeedTable } from "@/components/dashboard/responsive-signal-view";
import { useStrategyActions } from "@/hooks/use-strategy-actions";
import { cn } from "@/lib/utils";
import type { ActiveRun, SignalDirection } from "@/lib/api-types";
import {
  activeRunsAtom,
  engineHeartbeatsAtom,
  recentEvaluationsAtom,
  runHistoryAtom,
  signalsByStrategyAtom,
  strategiesAtom,
} from "@/store";

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function StrategyDetailPage() {
  const params = useParams<{ strategyId: string }>();
  const strategyId = params.strategyId;

  const [activeRuns] = useAtom(activeRunsAtom);
  const [signalsByStrategy] = useAtom(signalsByStrategyAtom);
  const [strategies] = useAtom(strategiesAtom);
  const [runHistory] = useAtom(runHistoryAtom);
  const [heartbeats] = useAtom(engineHeartbeatsAtom);
  const [evaluationsMap] = useAtom(recentEvaluationsAtom);
  const { handleStopRun, handleStartStrategy } = useStrategyActions();

  const heartbeat = heartbeats[strategyId];
  const evaluations = evaluationsMap[strategyId] || [];

  const [filterIndex, setFilterIndex] = useState<string | null>(null);
  const [filterDirection, setFilterDirection] = useState<SignalDirection | null>(null);

  const strategy = strategies.find((s) => s.id === strategyId);
  const allSignals = signalsByStrategy[strategyId] || [];
  const run = activeRuns.find(
    (r) =>
      r.strategy_id === strategyId &&
      (r.status === "running" || r.status === "starting"),
  );
  const isRunning = run?.status === "running" || run?.status === "starting";

  const strategyRuns = useMemo(
    () => runHistory.filter((r) => r.strategy_id === strategyId),
    [runHistory, strategyId],
  );

  const latestRun: ActiveRun | undefined = run ?? strategyRuns[0];

  // Unique indices from evaluations for filter pills
  const indices = useMemo(() => {
    const set = new Set(evaluations.map((e) => e.index_name));
    return Array.from(set).sort();
  }, [evaluations]);

  const directions: { value: SignalDirection | null; label: string }[] = [
    { value: null, label: "All" },
    { value: "LONG_BIAS", label: "Long" },
    { value: "SHORT_BIAS", label: "Short" },
    { value: "NEUTRAL", label: "Neutral" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">
                {strategy?.name ?? strategyId}
              </h1>
              {run?.status && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase",
                    run.status === "running"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : run.status === "starting"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : "",
                  )}
                >
                  {run.status}
                </Badge>
              )}
              {/* Engine heartbeat mini stats */}
              {heartbeat && (
                <div className="hidden sm:flex items-center gap-3 ml-2 text-[10px] text-muted-foreground/50">
                  <span>{heartbeat.ticks_processed.toLocaleString()} ticks</span>
                  <span>{heartbeat.snapshots} snaps</span>
                  <span>{heartbeat.evaluations} evals</span>
                  {heartbeat.stale_indices.length > 0 && (
                    <span className="text-amber-400 flex items-center gap-0.5">
                      <AlertTriangle className="size-2.5" />
                      stale: {heartbeat.stale_indices.join(", ")}
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {strategy?.description ?? `Strategy ID: ${strategyId}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && run ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleStopRun(run.id)}
              className="gap-1.5 h-7 text-xs"
            >
              <Square className="size-3" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => handleStartStrategy(strategyId)}
              className="gap-1.5 h-7 text-xs"
            >
              <Activity className="size-3" />
              Start
            </Button>
          )}
        </div>
      </div>

      {/* Status banners (compact) */}
      {latestRun?.status === "error" && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs">
          <XCircle className="size-3.5 shrink-0 text-red-400" />
          <span className="text-red-400 font-medium">Error:</span>
          <span className="text-red-400/70 truncate">{latestRun.error_message ?? "Unknown error"}</span>
        </div>
      )}
      {latestRun?.status === "expired" && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs">
          <Timer className="size-3.5 shrink-0 text-amber-400" />
          <span className="text-amber-400">Kite token expired. Reconnect to resume.</span>
        </div>
      )}
      {isRunning && evaluations.length === 0 && allSignals.length === 0 && (
        <div className="flex items-center gap-2 rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs">
          <Info className="size-3.5 shrink-0 text-blue-400" />
          <span className="text-blue-400">Collecting market data... evaluations will appear shortly.</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="live" className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <TabsList className="h-8">
            <TabsTrigger value="live" className="text-xs h-7 px-3">Live Feed</TabsTrigger>
            <TabsTrigger value="charts" className="text-xs h-7 px-3">Charts</TabsTrigger>
            <TabsTrigger value="details" className="text-xs h-7 px-3">Details</TabsTrigger>
          </TabsList>

          {/* Inline filter toolbar (only on Live Feed tab) */}
        </div>

        {/* Live Feed tab */}
        <TabsContent value="live" className="space-y-0 mt-0">
          {/* Filter toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* Index pills */}
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setFilterIndex(null)}
                className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                  filterIndex === null
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              {indices.map((idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setFilterIndex(idx)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                    filterIndex === idx
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {idx}
                </button>
              ))}
            </div>

            {/* Direction pills */}
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
              {directions.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setFilterDirection(d.value)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                    filterDirection === d.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Live indicator */}
            {isRunning && (
              <div className="flex items-center gap-1.5 ml-auto text-[10px] text-emerald-400/60">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                Live
              </div>
            )}
          </div>

          {/* Spreadsheet */}
          <Card className="overflow-hidden">
            <CardContent className="p-0 md:p-0">
              <LiveFeedTable
                evaluations={evaluations}
                filterIndex={filterIndex}
                filterDirection={filterDirection}
                run={latestRun}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts tab */}
        <TabsContent value="charts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ConfidenceTimeline signals={allSignals} />
            <SignalDistribution signals={allSignals} />
          </div>
          <IndexBreakdown signals={allSignals} />
        </TabsContent>

        {/* Details tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">Description</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {strategy?.description ?? "No description available."}
                </p>
              </div>

              {strategy?.how_it_works && (
                <div>
                  <h3 className="text-sm font-semibold mb-1">How It Works</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {strategy.how_it_works}
                  </p>
                </div>
              )}

              {strategy?.params && Object.keys(strategy.params).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Parameters</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(strategy.params).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
                      >
                        <span className="text-xs text-muted-foreground font-mono">
                          {key}
                        </span>
                        <span className="text-xs font-medium font-mono">
                          {JSON.stringify(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Engine status */}
              {heartbeat && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Engine Status</h3>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ticks</p>
                      <p className="text-sm font-mono font-medium">{heartbeat.ticks_processed.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Snapshots</p>
                      <p className="text-sm font-mono font-medium">{heartbeat.snapshots}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Evaluations</p>
                      <p className="text-sm font-mono font-medium">{heartbeat.evaluations}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Alerts</p>
                      <p className="text-sm font-mono font-medium">{heartbeat.alerts}</p>
                    </div>
                  </div>
                  {heartbeat.current_minute && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Processing: <span className="font-mono">{new Date(heartbeat.current_minute).toLocaleTimeString()}</span>
                      {heartbeat.eta_seconds > 0 && (
                        <span className="text-muted-foreground/50"> (next in {heartbeat.eta_seconds}s)</span>
                      )}
                    </p>
                  )}
                </div>
              )}

              {run && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Current Run</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Run ID</span>
                      <span className="text-xs font-medium font-mono">#{run.id}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Started</span>
                      <span className="text-xs font-medium font-mono">
                        {run.started_at
                          ? new Date(run.started_at).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {strategyRuns.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Run History</h3>
                  <div className="space-y-1.5">
                    {strategyRuns.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] uppercase shrink-0",
                            r.status === "running"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : r.status === "error"
                                ? "border-red-500/30 bg-red-500/10 text-red-400"
                                : r.status === "expired"
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                  : "border-border text-muted-foreground",
                          )}
                        >
                          {r.status}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono text-muted-foreground">
                              #{r.id}
                            </span>
                            <span className="text-muted-foreground/60">
                              {r.started_at
                                ? new Date(r.started_at).toLocaleString()
                                : "—"}
                            </span>
                            {r.signals_count > 0 && (
                              <span className="text-muted-foreground">
                                {r.signals_count} signal{r.signals_count !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          {r.error_message && (
                            <p className="mt-0.5 text-xs text-red-400/70 truncate" title={r.error_message}>
                              {r.error_message}
                            </p>
                          )}
                        </div>
                        {r.stopped_at && r.started_at && (
                          <span className="text-[10px] text-muted-foreground/50 font-mono shrink-0">
                            {formatDuration(new Date(r.started_at), new Date(r.stopped_at))}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
