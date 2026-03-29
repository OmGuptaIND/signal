"use client";

import { useAtom } from "jotai";
import { useCallback } from "react";
import type { ActiveRun } from "@/lib/api-types";
import { activeRunsAtom, authStatusAtom } from "@/store";

export function useStrategyActions() {
  const [authStatus] = useAtom(authStatusAtom);
  const [, setActiveRuns] = useAtom(activeRunsAtom);

  const handleKiteLogin = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/kite");
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.login_url;
      }
    } catch (err) {
      console.error("Login failed:", err);
    }
  }, []);

  const handleStopRun = useCallback(
    async (runId: number) => {
      try {
        const res = await fetch(`/api/proxy/runs/${runId}/stop`, {
          method: "POST",
        });
        if (res.ok) {
          setActiveRuns((prev) =>
            prev.map((r) =>
              r.id === runId ? { ...r, status: "stopped" as const } : r,
            ),
          );
        }
      } catch (err) {
        console.error("Failed to stop run:", err);
      }
    },
    [setActiveRuns],
  );

  const handleStartStrategy = useCallback(
    async (strategyId: string) => {
      if (!authStatus?.is_connected) return;
      try {
        const startRes = await fetch("/api/proxy/runs/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: "from_env",
            api_key: "from_env",
            api_secret: "from_env",
            strategy_id: strategyId,
          }),
        });
        if (startRes.ok) {
          const data = await startRes.json();
          setActiveRuns((prev) => [...prev, data.run as ActiveRun]);
        }
      } catch (err) {
        console.error("Failed to start strategy:", err);
      }
    },
    [authStatus, setActiveRuns],
  );

  return { handleKiteLogin, handleStopRun, handleStartStrategy };
}
