"use client";

import { useAtom } from "jotai";
import { useEffect, useRef } from "react";
import type { SSEEvent, Signal } from "@/lib/api-types";
import { signalsByStrategyAtom, sseConnectedAtom } from "@/store";

export function useSSEStream() {
  const [, setSignalsByStrategy] = useAtom(signalsByStrategyAtom);
  const [, setSSEConnected] = useAtom(sseConnectedAtom);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      try {
        const res = await fetch("/api/proxy/stream-token");
        if (!res.ok || cancelled) return;
        const { token, streamUrl } = await res.json();

        const es = new EventSource(`${streamUrl}?stream_token=${token}`);
        if (cancelled) { es.close(); return; }
        eventSourceRef.current = es;

        es.onopen = () => setSSEConnected(true);

        es.onmessage = (event) => {
          try {
            const parsed: SSEEvent = JSON.parse(event.data as string);
            if (parsed.type === "new_signal") {
              const signal = parsed.data as Signal;
              const sid = signal.strategy_id || "template_d";
              setSignalsByStrategy((prev) => ({
                ...prev,
                [sid]: [signal, ...(prev[sid] || [])].slice(0, 100),
              }));
            }
          } catch (err) {
            console.error("Error parsing SSE data", err);
          }
        };

        es.onerror = () => {
          setSSEConnected(false);
          es.close();
          eventSourceRef.current = null;
          // Reconnect after 3s with a fresh token
          if (!cancelled) setTimeout(connect, 3000);
        };
      } catch (err) {
        console.error("SSE setup failed", err);
        if (!cancelled) setTimeout(connect, 3000);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setSSEConnected(false);
    };
  }, [setSignalsByStrategy, setSSEConnected]);
}
