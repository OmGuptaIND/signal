"use client";

import { useAtom } from "jotai";
import { Activity, BarChart3, Clock, Wifi, Zap } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/dashboard/stat-card";
import { StrategyOverviewCard } from "@/components/dashboard/strategy-overview-card";
import { ResponsiveSignalView } from "@/components/dashboard/responsive-signal-view";
import { useStrategyActions } from "@/hooks/use-strategy-actions";
import {
  activeRunsAtom,
  activeStrategyIdsAtom,
  allSignalsAtom,
  authStatusAtom,
  signalsByStrategyAtom,
  strategiesAtom,
} from "@/store";

export default function OverviewPage() {
  const [allSignals] = useAtom(allSignalsAtom);
  const [authStatus] = useAtom(authStatusAtom);
  const [activeRuns] = useAtom(activeRunsAtom);
  const [activeStrategyIds] = useAtom(activeStrategyIdsAtom);
  const [strategies] = useAtom(strategiesAtom);
  const [signalsByStrategy] = useAtom(signalsByStrategyAtom);
  const { handleStopRun } = useStrategyActions();

  const isConnected = authStatus?.is_connected ?? false;

  const getStrategyName = (id: string) =>
    strategies.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          Overview
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitor your active strategies and real-time signals.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Total Signals"
          value={allSignals.length}
        />
        <StatCard
          icon={BarChart3}
          label="Active Strategies"
          value={activeStrategyIds.length}
          variant={activeStrategyIds.length > 0 ? "success" : "default"}
        />
        <StatCard
          icon={Wifi}
          label="Kite API"
          value={isConnected ? "Online" : "Offline"}
          subtitle={authStatus?.message}
          variant={isConnected ? "success" : "danger"}
        />
        <StatCard
          icon={Clock}
          label="Last Signal"
          value={
            allSignals.length > 0
              ? new Date(allSignals[0]!.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "—"
          }
          subtitle={allSignals.length > 0 ? allSignals[0]!.index_name : "Waiting for data"}
        />
      </div>

      {/* Active Strategy Cards */}
      {activeStrategyIds.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Active Strategies
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeStrategyIds.map((strategyId) => (
              <StrategyOverviewCard
                key={strategyId}
                strategyId={strategyId}
                strategyName={getStrategyName(strategyId)}
                signals={signalsByStrategy[strategyId] || []}
                run={activeRuns.find(
                  (r) =>
                    r.strategy_id === strategyId &&
                    (r.status === "running" || r.status === "starting"),
                )}
                onStop={handleStopRun}
              />
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/50 mb-4">
              <Zap className="size-6 text-muted-foreground/40" />
            </div>
            <h3 className="font-semibold text-base">No strategies running</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {isConnected
                ? "Click \"Add Strategy\" in the header to start receiving live trading signals."
                : "Connect your Kite API first, then add strategies to begin."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent signals */}
      {allSignals.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Recent Signals
            </h2>
            {activeStrategyIds.length > 0 && (
              <Link
                href={`/strategy/${activeStrategyIds[0]}`}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all →
              </Link>
            )}
          </div>
          <Card>
            <CardContent className="p-0 md:p-0">
              <ResponsiveSignalView signals={allSignals} maxItems={10} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
