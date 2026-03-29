"use client";

import { useAtom } from "jotai";
import { useEffect } from "react";
import type { ActiveRun, AuthStatusResponse, Signal, Strategy } from "@/lib/api-types";
import {
  activeRunsAtom,
  authStatusAtom,
  signalsByStrategyAtom,
  strategiesAtom,
} from "@/store";

export function useInitialData() {
  const [, setSignalsByStrategy] = useAtom(signalsByStrategyAtom);
  const [, setAuthStatus] = useAtom(authStatusAtom);
  const [, setActiveRuns] = useAtom(activeRunsAtom);
  const [, setStrategies] = useAtom(strategiesAtom);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [authRes, histRes, runsRes, stratRes] = await Promise.all([
          fetch("/api/proxy/auth/status"),
          fetch("/api/proxy/signals/history"),
          fetch("/api/proxy/runs/active"),
          fetch("/api/proxy/strategies"),
        ]);

        if (authRes.ok) {
          const authData: AuthStatusResponse = await authRes.json();
          setAuthStatus(authData);
        }

        if (histRes.ok) {
          const histData = await histRes.json();
          const grouped: Record<string, Signal[]> = {};
          for (const signal of histData.signals as Signal[]) {
            const sid = signal.strategy_id || "template_d";
            if (!grouped[sid]) grouped[sid] = [];
            grouped[sid].push(signal);
          }
          setSignalsByStrategy(grouped);
        }

        if (runsRes.ok) {
          const runsData = await runsRes.json();
          setActiveRuns(runsData.runs as ActiveRun[]);
        }

        if (stratRes.ok) {
          const stratData = await stratRes.json();
          setStrategies(stratData.strategies as Strategy[]);
        }
      } catch (err) {
        console.error("Failed to load initial data", err);
      }
    };

    void fetchInitialData();
  }, [setSignalsByStrategy, setAuthStatus, setActiveRuns, setStrategies]);
}
