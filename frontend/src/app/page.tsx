"use client";

import { useAtom } from "jotai";
import { Activity, Clock, Radio, TrendingUp, Wifi } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Header } from "@/components/dashboard/header";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SignalTable } from "@/components/dashboard/signal-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusDot } from "@/components/dashboard/status-dot";
import { env } from "@/env";
import type { SSEEvent } from "@/lib/api-types";
import {
	type ActiveRun,
	type AuthStatus,
	activeRunAtom,
	authStatusAtom,
	type Signal,
	signalsAtom,
} from "@/store";

export default function HomePage() {
	const [signals, setSignals] = useAtom(signalsAtom);
	const [authStatus, setAuthStatus] = useAtom(authStatusAtom);
	const [activeRun, setActiveRun] = useAtom(activeRunAtom);

	useEffect(() => {
		const fetchInitialData = async () => {
			try {
				const [authRes, histRes, runRes] = await Promise.all([
					fetch(`${env.NEXT_PUBLIC_BACKEND_URL}/api/auth/status`),
					fetch(`${env.NEXT_PUBLIC_BACKEND_URL}/api/signals/history`),
					fetch(`${env.NEXT_PUBLIC_BACKEND_URL}/api/runs/active`),
				]);

				if (authRes.ok) {
					const authData: AuthStatus = await authRes.json();
					setAuthStatus(authData);
				}

				if (histRes.ok) {
					const histData = await histRes.json();
					setSignals(histData.signals);
				}

				if (runRes.ok) {
					const runData = await runRes.json();
					setActiveRun(runData.run as ActiveRun | null);
				}
			} catch (err) {
				console.error("Failed to load initial data", err);
			}
		};

		void fetchInitialData();

		const eventSource = new EventSource(
			`${env.NEXT_PUBLIC_BACKEND_URL}/api/signals/stream`,
		);

		eventSource.onmessage = (event) => {
			try {
				const parsed: SSEEvent = JSON.parse(event.data as string);
				if (parsed.type === "new_signal") {
					setSignals((prev: Signal[]) => [parsed.data, ...prev].slice(0, 50));
				}
			} catch (err) {
				console.error("Error parsing SSE data", err);
			}
		};

		eventSource.onerror = (err) => {
			console.error("SSE connection error", err);
			eventSource.close();
		};

		return () => {
			eventSource.close();
		};
	}, [setSignals, setAuthStatus, setActiveRun]);

	const handleKiteLogin = async () => {
		try {
			const res = await fetch("/api/auth/kite");
			if (res.ok) {
				const data = await res.json();
				window.location.href = data.login_url;
			}
		} catch (err) {
			console.error("Login failed:", err);
		}
	};

	const isConnected = authStatus?.is_connected ?? false;
	const tokenExpiryLabel = activeRun?.token_expires_at
		? new Date(activeRun.token_expires_at).toLocaleString()
		: "Not available";

	const strategySummary = useMemo(() => {
		if (signals.length === 0) {
			return {
				dominant: "No data",
				buy: 0,
				sell: 0,
				neutral: 0,
				avgConfidence: 0,
			};
		}

		const buy = signals.filter(
			(s) => s.signal.toUpperCase() === "LONG_BIAS",
		).length;
		const sell = signals.filter(
			(s) => s.signal.toUpperCase() === "SHORT_BIAS",
		).length;
		const neutral = signals.length - buy - sell;
		const avgConfidence =
			signals.reduce((acc, s) => acc + Number(s.confidence || 0), 0) /
			signals.length;

		const dominant =
			buy >= sell && buy >= neutral
				? "LONG bias"
				: sell >= buy && sell >= neutral
					? "SHORT bias"
					: "NEUTRAL";

		return { dominant, buy, sell, neutral, avgConfidence };
	}, [signals]);

	const lastSignalTime =
		signals.length > 0
			? new Date(signals[0]?.timestamp ?? Date.now()).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
				})
			: "—";

	return (
		<div className="min-h-screen bg-[#0a0a0a] text-foreground selection:bg-blue-500/20">
			{/* Sidebar */}
			<Sidebar isConnected={isConnected} />

			{/* Main Content */}
			<div className="flex min-h-screen flex-col lg:pl-[220px]">
				{/* Header */}
				<Header
					activeRun={activeRun}
					authStatus={authStatus}
					onConnect={handleKiteLogin}
					signalCount={signals.length}
				/>

				{/* Page Content */}
				<main className="flex-1 p-6">
					{/* Stat Cards Row */}
					<div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<StatCard
							icon={Activity}
							label="Total Signals"
							value={signals.length}
							variant={signals.length > 0 ? "default" : "default"}
						/>
						<StatCard
							icon={Clock}
							label="Last Signal"
							subtitle={signals.length > 0 ? signals[0]?.index_name : undefined}
							value={lastSignalTime}
							variant="default"
						/>
						<StatCard
							icon={Wifi}
							label="Kite API"
							subtitle={authStatus?.message}
							value={isConnected ? "Online" : "Offline"}
							variant={isConnected ? "success" : "danger"}
						/>
						<StatCard
							icon={Radio}
							label="SSE Stream"
							subtitle="Real-time data feed"
							value={signals.length > 0 ? "Active" : "Idle"}
							variant={signals.length > 0 ? "success" : "warning"}
						/>
					</div>

					{/* Signal Table */}
					<div className="animate-fade-in overflow-hidden rounded-lg border border-border bg-[#111111]">
						{/* Table Header */}
						<div className="flex h-11 items-center justify-between border-border border-b px-4">
							<div className="flex items-center gap-2">
								<StatusDot
									pulse={signals.length > 0}
									size="sm"
									status={signals.length > 0 ? "online" : "idle"}
								/>
								<span className="font-medium text-[13px] text-white">
									Signal Feed
								</span>
							</div>
							<span className="font-mono text-[11px] text-muted-foreground/50">
								Streaming via SSE
							</span>
						</div>

						{/* Table Body */}
						<SignalTable signals={signals} />
					</div>

					{/* System Diagnostics Footer */}
					<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div className="rounded-lg border border-border bg-[#111111] p-4">
							<p className="mb-2 font-medium text-[11px] text-muted-foreground/60 uppercase tracking-wider">
								Auth State
							</p>
							<p className="break-words font-mono text-[13px] text-muted-foreground">
								{authStatus?.message || "Checking status..."}
							</p>
							{authStatus?.last_updated_at && (
								<p className="mt-2 font-mono text-[11px] text-muted-foreground/40">
									{new Date(authStatus.last_updated_at).toLocaleString()}
								</p>
							)}
						</div>
						<div className="rounded-lg border border-border bg-[#111111] p-4">
							<p className="mb-2 font-medium text-[11px] text-muted-foreground/60 uppercase tracking-wider">
								SSE Stream
							</p>
							<div className="flex items-center gap-2">
								<StatusDot
									pulse={signals.length > 0}
									size="md"
									status={signals.length > 0 ? "online" : "idle"}
								/>
								<span className="font-mono text-[13px] text-muted-foreground">
									Listening on {signals.length > 0 ? "Active" : "Idle"}
								</span>
							</div>
						</div>
						<div className="rounded-lg border border-border bg-[#111111] p-4">
							<p className="mb-2 font-medium text-[11px] text-muted-foreground/60 uppercase tracking-wider">
								Token & Run
							</p>
							<p className="font-mono text-[13px] text-muted-foreground">
								{activeRun
									? `Run ${activeRun.id} (${activeRun.status})`
									: "No active run"}
							</p>
							<p className="mt-2 font-mono text-[11px] text-muted-foreground/60">
								Token expiry: {tokenExpiryLabel}
							</p>
						</div>
						<div className="rounded-lg border border-border bg-[#111111] p-4">
							<p className="mb-2 font-medium text-[11px] text-muted-foreground/60 uppercase tracking-wider">
								Strategy Alignment
							</p>
							<div className="flex items-center gap-2">
								<TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
								<span className="font-mono text-[13px] text-muted-foreground">
									{strategySummary.dominant}
								</span>
							</div>
							<p className="mt-2 font-mono text-[11px] text-muted-foreground/60">
								LONG {strategySummary.buy} | SHORT {strategySummary.sell} |
								NEUTRAL {strategySummary.neutral}
							</p>
							<p className="mt-1 font-mono text-[11px] text-muted-foreground/60">
								Avg confidence:{" "}
								{(strategySummary.avgConfidence * 100).toFixed(1)}%
							</p>
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}
