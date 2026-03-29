"use client";

import { Activity, Clock, Square, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ActiveRun, Signal } from "@/lib/api-types";
import { SignalTable } from "./signal-table";
import { StatCard } from "./stat-card";
import { StatusDot } from "./status-dot";

interface StrategyPanelProps {
	strategyId: string;
	strategyName: string;
	signals: Signal[];
	run: ActiveRun | undefined;
	onStop: (runId: number) => void;
}

export function StrategyPanel({
	strategyId,
	strategyName,
	signals,
	run,
	onStop,
}: StrategyPanelProps) {
	const isRunning = run?.status === "running" || run?.status === "starting";

	const summary = useMemo(() => {
		if (signals.length === 0) {
			return { dominant: "No data", buy: 0, sell: 0, neutral: 0, avgConfidence: 0 };
		}
		const buy = signals.filter((s) => s.signal.toUpperCase() === "LONG_BIAS").length;
		const sell = signals.filter((s) => s.signal.toUpperCase() === "SHORT_BIAS").length;
		const neutral = signals.length - buy - sell;
		const avgConfidence =
			signals.reduce((acc, s) => acc + Number(s.confidence || 0), 0) / signals.length;
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
		<div className="rounded-xl border border-border bg-[#0d0d0d] overflow-hidden animate-fade-in">
			{/* Panel Header */}
			<div className="flex items-center justify-between border-b border-border px-5 py-3">
				<div className="flex items-center gap-3">
					<StatusDot
						pulse={isRunning}
						size="md"
						status={isRunning ? "online" : "idle"}
					/>
					<div>
						<h3 className="font-semibold text-[14px] text-white">
							{strategyName}
						</h3>
						<p className="text-[11px] text-muted-foreground/50 font-mono">
							{strategyId} · {run ? `Run #${run.id}` : "Not running"}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{run?.status && (
						<span
							className={cn(
								"px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider",
								run.status === "running"
									? "bg-emerald-500/10 text-emerald-400"
									: run.status === "starting"
										? "bg-amber-500/10 text-amber-400"
										: run.status === "error"
											? "bg-red-500/10 text-red-400"
											: "bg-white/[0.06] text-muted-foreground",
							)}
						>
							{run.status}
						</span>
					)}
					{isRunning && run && (
						<button
							type="button"
							onClick={() => onStop(run.id)}
							className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors"
						>
							<Square className="w-3 h-3" />
							Stop
						</button>
					)}
				</div>
			</div>

			{/* Stats Row */}
			<div className="grid grid-cols-2 gap-2 p-3 lg:grid-cols-4">
				<StatCard
					icon={Activity}
					label="Signals"
					value={signals.length}
				/>
				<StatCard
					icon={Clock}
					label="Last Signal"
					subtitle={signals.length > 0 ? signals[0]?.index_name : undefined}
					value={lastSignalTime}
				/>
				<StatCard
					icon={TrendingUp}
					label="Dominant"
					value={summary.dominant}
					variant={
						summary.dominant.includes("LONG")
							? "success"
							: summary.dominant.includes("SHORT")
								? "danger"
								: "default"
					}
				/>
				<StatCard
					icon={Activity}
					label="Avg Confidence"
					value={`${(summary.avgConfidence * 100).toFixed(1)}%`}
					subtitle={`L${summary.buy} S${summary.sell} N${summary.neutral}`}
					variant={
						summary.avgConfidence >= 0.7
							? "success"
							: summary.avgConfidence >= 0.4
								? "warning"
								: "default"
					}
				/>
			</div>

			{/* Signal Table */}
			<div className="border-t border-border">
				<div className="flex h-9 items-center justify-between border-b border-border px-4">
					<div className="flex items-center gap-2">
						<StatusDot
							pulse={signals.length > 0}
							size="sm"
							status={signals.length > 0 ? "online" : "idle"}
						/>
						<span className="font-medium text-[12px] text-white">
							Signal Feed
						</span>
					</div>
					<span className="font-mono text-[10px] text-muted-foreground/40">
						{signals.length} signals
					</span>
				</div>
				<SignalTable signals={signals} />
			</div>
		</div>
	);
}
