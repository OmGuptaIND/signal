"use client";

import { useAtom } from "jotai";
import {
  CheckCircle2,
  Radio,
  Wifi,
  WifiOff,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  activeStrategyIdsAtom,
  allSignalsAtom,
  authStatusAtom,
  sseConnectedAtom,
} from "@/store";

export function ConnectionPill() {
  const [authStatus] = useAtom(authStatusAtom);
  const [sseConnected] = useAtom(sseConnectedAtom);
  const [allSignals] = useAtom(allSignalsAtom);
  const [activeStrategyIds] = useAtom(activeStrategyIdsAtom);

  const isKiteConnected = authStatus?.is_connected ?? false;
  const isFullyConnected = isKiteConnected && sseConnected;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-sidebar-accent cursor-pointer",
          isFullyConnected
            ? "bg-emerald-500/5"
            : isKiteConnected
              ? "bg-amber-500/5"
              : "bg-red-500/5",
        )}
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {isFullyConnected && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={cn(
              "relative inline-flex h-2.5 w-2.5 rounded-full",
              isFullyConnected
                ? "bg-emerald-400"
                : isKiteConnected
                  ? "bg-amber-400"
                  : "bg-red-400",
            )}
          />
        </span>
        <span className="flex-1 text-xs font-medium truncate">
          {isFullyConnected
            ? "Live"
            : isKiteConnected
              ? "Partial"
              : "Offline"}
        </span>
        <span
          className={cn(
            "text-[10px] font-mono tabular-nums",
            isFullyConnected
              ? "text-emerald-400"
              : "text-muted-foreground",
          )}
        >
          {allSignals.length > 0 ? `${allSignals.length}s` : "—"}
        </span>
      </PopoverTrigger>

      <PopoverContent side="right" align="start" sideOffset={8} className="w-72">
        <div className="space-y-3">
          {/* Header */}
          <div>
            <h4 className="font-semibold text-sm">Connection Status</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time data pipeline health
            </p>
          </div>

          <Separator />

          {/* Kite API */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-lg shrink-0",
                isKiteConnected ? "bg-emerald-500/10" : "bg-red-500/10",
              )}
            >
              {isKiteConnected ? (
                <CheckCircle2 className="size-4 text-emerald-400" />
              ) : (
                <XCircle className="size-4 text-red-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">Kite API</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {authStatus?.message ?? "Checking..."}
              </p>
            </div>
            <span
              className={cn(
                "text-[10px] font-medium uppercase",
                isKiteConnected ? "text-emerald-400" : "text-red-400",
              )}
            >
              {isKiteConnected ? "OK" : "Down"}
            </span>
          </div>

          {/* SSE Stream */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-lg shrink-0",
                sseConnected ? "bg-blue-500/10" : "bg-muted/50",
              )}
            >
              {sseConnected ? (
                <Wifi className="size-4 text-blue-400" />
              ) : (
                <WifiOff className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">Live Stream</p>
              <p className="text-[10px] text-muted-foreground">
                Server-Sent Events
              </p>
            </div>
            <span
              className={cn(
                "text-[10px] font-medium uppercase",
                sseConnected ? "text-blue-400" : "text-muted-foreground",
              )}
            >
              {sseConnected ? "Live" : "Off"}
            </span>
          </div>

          <Separator />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-sm font-bold tabular-nums">
                {activeStrategyIds.length}
              </p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                Strategies
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold tabular-nums">
                {allSignals.length}
              </p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                Signals
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold tabular-nums">
                {allSignals.length > 0
                  ? new Date(allSignals[0]!.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                Last Signal
              </p>
            </div>
          </div>

          {authStatus?.last_updated_at && (
            <p className="text-[10px] text-muted-foreground/50 text-center font-mono">
              Updated {new Date(authStatus.last_updated_at).toLocaleString()}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
