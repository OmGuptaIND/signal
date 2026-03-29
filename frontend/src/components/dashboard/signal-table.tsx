"use client";

import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Signal } from "@/store";
import { StatusDot } from "./status-dot";

interface SignalTableProps {
	signals: Signal[];
}

export function SignalTable({ signals }: SignalTableProps) {
	if (signals.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
				<div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/[0.04] mb-4">
					<Activity className="w-6 h-6 text-muted-foreground/30" />
				</div>
				<p className="text-[14px] font-medium text-muted-foreground/80">
					No signals captured yet
				</p>
				<p className="text-[12px] text-muted-foreground/50 mt-1 max-w-[280px]">
					Ensure your Kite API is connected and the market is open to start
					receiving live signals.
				</p>
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="w-full text-[13px]">
				<thead>
					<tr className="border-b border-border">
						<th className="h-9 px-4 text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
							Time
						</th>
						<th className="h-9 px-4 text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
							Index
						</th>
						<th className="h-9 px-4 text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
							Signal
						</th>
						<th className="h-9 px-4 text-right text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
							Spot
						</th>
						<th className="h-9 px-4 text-right text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider w-[140px]">
							Confidence
						</th>
						<th className="h-9 px-4 text-right text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
							Delta
						</th>
						<th className="h-9 px-4 text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
							Reason
						</th>
					</tr>
				</thead>
				<tbody>
					{signals.map((signal, i) => {
						const signalType = signal.signal.toUpperCase();
						const confidence = Number(signal.confidence);
						const confidencePercent = (confidence * 100).toFixed(1);

						return (
							<tr
								key={`${signal.id}-${signal.timestamp}`}
								className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors group"
								style={{ animationDelay: `${i * 30}ms` }}
							>
								{/* Time */}
								<td className="h-10 px-4 font-mono text-muted-foreground">
									{new Date(signal.timestamp).toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
										second: "2-digit",
									})}
								</td>

								{/* Index */}
								<td className="h-10 px-4 font-medium text-white">
									{signal.index_name}
								</td>

								{/* Signal */}
								<td className="h-10 px-4">
									<div className="flex items-center gap-2">
										<StatusDot
											status={
												signalType === "BUY"
													? "online"
													: signalType === "SELL"
														? "offline"
														: "warning"
											}
											size="md"
										/>
										<span
											className={cn(
												"text-[12px] font-semibold uppercase tracking-wide",
												signalType === "BUY"
													? "text-emerald-400"
													: signalType === "SELL"
														? "text-red-400"
														: "text-amber-400",
											)}
										>
											{signalType}
										</span>
									</div>
								</td>

								{/* Spot Price */}
								<td className="h-10 px-4 text-right font-mono text-muted-foreground">
									{Number(signal.spot_price).toLocaleString("en-IN", {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									})}
								</td>

								{/* Confidence Bar */}
								<td className="h-10 px-4">
									<div className="flex items-center gap-2 justify-end">
										<div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden">
											<div
												className={cn(
													"h-full rounded-full transition-all duration-500",
													confidence >= 0.8
														? "bg-emerald-400"
														: confidence >= 0.5
															? "bg-amber-400"
															: "bg-red-400",
												)}
												style={{ width: `${confidence * 100}%` }}
											/>
										</div>
										<span
											className={cn(
												"font-mono text-[12px] tabular-nums w-12 text-right",
												confidence >= 0.8
													? "text-emerald-400"
													: confidence >= 0.5
														? "text-amber-400"
														: "text-red-400",
											)}
										>
											{confidencePercent}%
										</span>
									</div>
								</td>

								{/* Delta */}
								<td className="h-10 px-4 text-right font-mono text-muted-foreground">
									<span className="text-muted-foreground/60">
										{Number(signal.total_delta).toFixed(1)}
									</span>
									<span className="text-muted-foreground/30 mx-1">/</span>
									<span>{Number(signal.weighted_total_delta).toFixed(1)}</span>
								</td>

								{/* Reason */}
								<td
									className="h-10 px-4 max-w-[220px] truncate text-muted-foreground/60 group-hover:text-muted-foreground transition-colors"
									title={signal.reason}
								>
									{signal.reason}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
