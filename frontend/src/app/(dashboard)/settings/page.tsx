"use client";

import { useAtom } from "jotai";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Gift,
  Link as LinkIcon,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Square,
  User2,
  Wifi,
  WifiOff,
  XCircle,
  Zap,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStrategyActions } from "@/hooks/use-strategy-actions";
import { cn } from "@/lib/utils";
import type { InviteCode } from "@/lib/api-types";
import {
  activeRunsAtom,
  authStatusAtom,
  sseConnectedAtom,
  strategiesAtom,
} from "@/store";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={copy}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-400" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [authStatus] = useAtom(authStatusAtom);
  const [activeRuns] = useAtom(activeRunsAtom);
  const [strategies] = useAtom(strategiesAtom);
  const [sseConnected] = useAtom(sseConnectedAtom);
  const { handleKiteLogin, handleStopRun } = useStrategyActions();

  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [generating, setGenerating] = useState(false);

  const isConnected = authStatus?.is_connected ?? false;

  const fetchInviteCodes = useCallback(async () => {
    setLoadingCodes(true);
    try {
      const res = await fetch("/api/proxy/invite-codes/mine");
      if (res.ok) {
        const data = await res.json();
        setInviteCodes(data.invite_codes ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch invite codes:", err);
    } finally {
      setLoadingCodes(false);
    }
  }, []);

  useEffect(() => {
    fetchInviteCodes();
  }, [fetchInviteCodes]);

  const generateCodes = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/proxy/invite-codes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 3 }),
      });
      if (res.ok) {
        await fetchInviteCodes();
      }
    } catch (err) {
      console.error("Failed to generate codes:", err);
    } finally {
      setGenerating(false);
    }
  };

  const availableCodes = inviteCodes.filter((c) => !c.used);
  const usedCodes = inviteCodes.filter((c) => c.used);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your account, connections, and invite friends.
        </p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
        </TabsList>

        {/* ═══ Account Tab ═══ */}
        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User2 className="size-4" />
                Profile
              </CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={session?.user?.image ?? ""}
                    referrerPolicy="no-referrer"
                  />
                  <AvatarFallback className="text-xl">
                    {session?.user?.name?.charAt(0) ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">
                    {session?.user?.name ?? "User"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {session?.user?.email}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      <Shield className="mr-1 size-3" />
                      Member
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Sign out</p>
                  <p className="text-xs text-muted-foreground">
                    End your current session
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="gap-1.5"
                >
                  <LogOut className="size-3.5" />
                  Sign out
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Connection Tab ═══ */}
        <TabsContent value="connection" className="space-y-4">
          {/* Kite Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="size-4" />
                Kite API
              </CardTitle>
              <CardDescription>
                Connect your Zerodha Kite account for live market data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={cn(
                  "flex items-center gap-4 rounded-lg border p-4",
                  isConnected
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-red-500/20 bg-red-500/5",
                )}
              >
                <div
                  className={cn(
                    "flex size-12 items-center justify-center rounded-xl",
                    isConnected ? "bg-emerald-500/10" : "bg-red-500/10",
                  )}
                >
                  {isConnected ? (
                    <CheckCircle2 className="size-6 text-emerald-400" />
                  ) : (
                    <XCircle className="size-6 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">
                    {isConnected ? "Connected" : "Disconnected"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {authStatus?.message ?? "Checking connection status..."}
                  </p>
                  {authStatus?.last_updated_at && (
                    <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                      Updated{" "}
                      {new Date(authStatus.last_updated_at).toLocaleString()}
                    </p>
                  )}
                </div>
                {!isConnected && (
                  <Button size="sm" onClick={handleKiteLogin} className="gap-1.5 shrink-0">
                    <LinkIcon className="size-3.5" />
                    Connect
                  </Button>
                )}
              </div>

              {/* SSE Status */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex items-center gap-3">
                  {sseConnected ? (
                    <Wifi className="size-4 text-blue-400" />
                  ) : (
                    <WifiOff className="size-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Live Data Stream</p>
                    <p className="text-xs text-muted-foreground">
                      Server-Sent Events connection
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    sseConnected
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                      : "text-muted-foreground",
                  )}
                >
                  {sseConnected ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Invites Tab ═══ */}
        <TabsContent value="invites" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gift className="size-4" />
                    Invite Codes
                  </CardTitle>
                  <CardDescription>
                    Share invite codes to bring friends to SignalEdge
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchInviteCodes}
                    disabled={loadingCodes}
                    className="h-8 w-8 p-0"
                  >
                    <RefreshCw
                      className={cn(
                        "size-3.5",
                        loadingCodes && "animate-spin",
                      )}
                    />
                  </Button>
                  <Button
                    size="sm"
                    onClick={generateCodes}
                    disabled={generating}
                    className="gap-1.5"
                  >
                    {generating ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    Generate Codes
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-center">
                  <p className="text-lg font-bold tabular-nums">
                    {inviteCodes.length}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Total
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-center">
                  <p className="text-lg font-bold tabular-nums text-emerald-400">
                    {availableCodes.length}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Available
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-center">
                  <p className="text-lg font-bold tabular-nums">
                    {usedCodes.length}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Used
                  </p>
                </div>
              </div>

              {/* Available codes */}
              {availableCodes.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Available Codes
                  </p>
                  <div className="space-y-2">
                    {availableCodes.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between rounded-lg border border-emerald-500/10 bg-emerald-500/5 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-md bg-emerald-500/10">
                            <Gift className="size-4 text-emerald-400" />
                          </div>
                          <code className="font-mono text-sm font-semibold tracking-wider">
                            {invite.code}
                          </code>
                        </div>
                        <CopyButton text={invite.code} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Used codes */}
              {usedCodes.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Used Codes
                  </p>
                  <div className="space-y-1.5">
                    {usedCodes.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <Check className="size-4 text-muted-foreground/40" />
                          <code className="font-mono text-sm text-muted-foreground line-through">
                            {invite.code}
                          </code>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60">
                          {invite.used_at
                            ? new Date(invite.used_at).toLocaleDateString()
                            : "Used"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inviteCodes.length === 0 && !loadingCodes && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-muted/50 mb-3">
                    <Gift className="size-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium">No invite codes yet</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                    Generate invite codes to share with friends and colleagues who want to use SignalEdge.
                  </p>
                </div>
              )}

              {loadingCodes && inviteCodes.length === 0 && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Runs Tab ═══ */}
        <TabsContent value="runs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="size-4" />
                Strategy Runs
              </CardTitle>
              <CardDescription>
                Manage your active and recent strategy runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeRuns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-muted/50 mb-3">
                    <Zap className="size-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium">No strategy runs</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Start a strategy from the Overview page to see it here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeRuns.map((run) => {
                    const strategy = strategies.find(
                      (s) => s.id === run.strategy_id,
                    );
                    const isActive =
                      run.status === "running" || run.status === "starting";

                    return (
                      <div
                        key={run.id}
                        className={cn(
                          "rounded-lg border p-4 transition-colors",
                          isActive
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : run.status === "error"
                              ? "border-red-500/20 bg-red-500/5"
                              : "border-border",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "flex size-10 items-center justify-center rounded-lg",
                                isActive
                                  ? "bg-emerald-500/10"
                                  : "bg-muted/50",
                              )}
                            >
                              <Zap
                                className={cn(
                                  "size-5",
                                  isActive
                                    ? "text-emerald-400"
                                    : "text-muted-foreground",
                                )}
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm">
                                  {strategy?.name ?? run.strategy_id}
                                </p>
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
                              </div>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                Run #{run.id} · {run.signals_count} signals
                                {run.started_at && (
                                  <> · Started {new Date(run.started_at).toLocaleTimeString()}</>
                                )}
                              </p>
                              {run.error_message && (
                                <p className="text-xs text-red-400 mt-1">
                                  {run.error_message}
                                </p>
                              )}
                            </div>
                          </div>
                          {isActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:bg-red-500/10 hover:text-red-400 gap-1.5"
                              onClick={() => handleStopRun(run.id)}
                            >
                              <Square className="size-3.5" />
                              Stop
                            </Button>
                          )}
                        </div>

                        {/* Run details grid */}
                        {isActive && (
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-md bg-background/50 px-3 py-2">
                              <p className="text-[10px] text-muted-foreground uppercase">Signals</p>
                              <p className="text-sm font-semibold tabular-nums">{run.signals_count}</p>
                            </div>
                            <div className="rounded-md bg-background/50 px-3 py-2">
                              <p className="text-[10px] text-muted-foreground uppercase">Started</p>
                              <p className="text-sm font-semibold tabular-nums">
                                {run.started_at
                                  ? new Date(run.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                  : "—"}
                              </p>
                            </div>
                            <div className="rounded-md bg-background/50 px-3 py-2">
                              <p className="text-[10px] text-muted-foreground uppercase">Expires</p>
                              <p className="text-sm font-semibold tabular-nums">
                                {run.token_expires_at
                                  ? new Date(run.token_expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                  : "—"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
