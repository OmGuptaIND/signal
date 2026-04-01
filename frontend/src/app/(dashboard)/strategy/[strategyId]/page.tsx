"use client";

import { useAtom } from "jotai";
import { ArrowLeft, Clock, Activity, Square, TrendingUp, AlertTriangle, Info, XCircle, Timer } from "lucide-react";
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
import { ResponsiveSignalView } from "@/components/dashboard/responsive-signal-view";
import { SignalFilters } from "@/components/dashboard/signal-filters";
import { StatCard } from "@/components/dashboard/stat-card";
import { useStrategyActions } from "@/hooks/use-strategy-actions";
import { cn } from "@/lib/utils";
import type { ActiveRun, SignalDirection } from "@/lib/api-types";
import {
  activeRunsAtom,
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
  const { handleStopRun, handleStartStrategy } = useStrategyActions();

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

  // All runs for this strategy (sorted newest first)
  const strategyRuns = useMemo(
    () => runHistory.filter((r) => r.strategy_id === strategyId),
    [runHistory, strategyId],
  );

  // Latest run (active or most recent from history)
  const latestRun: ActiveRun | undefined = run ?? strategyRuns[0];

  const indices = useMemo(() => {
    const set = new Set(allSignals.map((s) => s.index_name));
    return Array.from(set).sort();
  }, [allSignals]);

  const filteredSignals = useMemo(() => {
    let signals = allSignals;
    if (filterIndex) {
      signals = signals.filter((s) => s.index_name === filterIndex);
    }
    if (filterDirection) {
      signals = signals.filter((s) => s.signal === filterDirection);
    }
    return signals;
  }, [allSignals, filterIndex, filterDirection]);

  const summary = useMemo(() => {
    if (allSignals.length === 0) {
      return { dominant: "—", long: 0, short: 0, neutral: 0, avgConfidence: 0 };
    }
    const long = allSignals.filter((s) => s.signal === "LONG_BIAS").length;
    const short = allSignals.filter((s) => s.signal === "SHORT_BIAS").length;
    const neutral = allSignals.length - long - short;
    const avgConfidence =
      allSignals.reduce((acc, s) => acc + Number(s.confidence || 0), 0) /
      allSignals.length;
    const dominant =
      long >= short && long >= neutral
        ? "LONG"
        : short >= long && short >= neutral
          ? "SHORT"
          : "NEUTRAL";
    return { dominant, long, short, neutral, avgConfidence };
  }, [allSignals]);

  const firstSignal = allSignals[0];
  const lastSignalTime =
    firstSignal
      ? new Date(firstSignal.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "—";

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {strategy?.name ?? strategyId}
              </h1>
              {run?.status && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs uppercase",
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
            </div>
            <p className="text-sm text-muted-foreground">
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
              className="gap-1.5"
            >
              <Square className="size-3.5" />
              Stop Strategy
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => handleStartStrategy(strategyId)}
              className="gap-1.5"
            >
              <Activity className="size-3.5" />
              Start Strategy
            </Button>
          )}
        </div>
      </div>

      {/* Status banner */}
      {latestRun?.status === "error" && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
          <XCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-400">Strategy encountered an error</p>
            <p className="mt-0.5 text-xs text-red-400/70">{latestRun.error_message ?? "Unknown error"}</p>
          </div>
        </div>
      )}
      {latestRun?.status === "expired" && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <Timer className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-400">Kite access token expired</p>
            <p className="mt-0.5 text-xs text-amber-400/70">
              Reconnect via Kite to resume data collection. Tokens expire at end of each trading day.
            </p>
          </div>
        </div>
      )}
      {isRunning && allSignals.length === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-blue-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-400">Collecting market data</p>
            <p className="mt-0.5 text-xs text-blue-400/70">
              Strategy is running and processing ticks. Signals will appear when market conditions match the strategy&apos;s criteria.
            </p>
          </div>
        </div>
      )}
      {!latestRun && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Strategy is not running</p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              Connect to Kite and start the strategy to begin receiving signals.
            </p>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Signals"
          value={allSignals.length}
          compact
        />
        <StatCard
          icon={Clock}
          label="Last Signal"
          value={lastSignalTime}
          compact
        />
        <StatCard
          icon={TrendingUp}
          label="Dominant Bias"
          value={summary.dominant}
          variant={
            summary.dominant === "LONG"
              ? "success"
              : summary.dominant === "SHORT"
                ? "danger"
                : "default"
          }
          compact
        />
        <StatCard
          icon={Activity}
          label="Avg Confidence"
          value={`${(summary.avgConfidence * 100).toFixed(0)}%`}
          subtitle={`L${summary.long} S${summary.short} N${summary.neutral}`}
          variant={
            summary.avgConfidence >= 0.7
              ? "success"
              : summary.avgConfidence >= 0.4
                ? "warning"
                : "default"
          }
          compact
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="signals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="signals">Signals</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Signals tab */}
        <TabsContent value="signals" className="space-y-4">
          <SignalFilters
            selectedIndex={filterIndex}
            selectedDirection={filterDirection}
            onIndexChange={setFilterIndex}
            onDirectionChange={setFilterDirection}
            indices={indices}
          />
          <Card>
            <CardContent className="p-0 md:p-0">
              <ResponsiveSignalView signals={filteredSignals} run={latestRun} />
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

              {run && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Current Run</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Run ID</span>
                      <span className="text-xs font-medium font-mono">#{run.id}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Status</span>
                      <span className="text-xs font-medium">{run.status}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Started</span>
                      <span className="text-xs font-medium font-mono">
                        {run.started_at
                          ? new Date(run.started_at).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Signals</span>
                      <span className="text-xs font-medium font-mono">
                        {run.signals_count}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {strategyRuns.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Run History</h3>
                  <div className="space-y-2">
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
