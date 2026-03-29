"use client";

import { ChevronDown, ChevronUp, Info, Play, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Strategy } from "@/lib/api-types";

interface StrategyPickerProps {
	strategies: Strategy[];
	activeStrategyIds: string[];
	onAdd: (strategyId: string) => void;
	onClose: () => void;
}

export function StrategyPicker({
	strategies,
	activeStrategyIds,
	onAdd,
	onClose,
}: StrategyPickerProps) {
	const [expandedId, setExpandedId] = useState<string | null>(null);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="w-full max-w-lg rounded-xl border border-border bg-[#111111] shadow-2xl animate-fade-in">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-border px-5 py-4">
					<div>
						<h2 className="font-semibold text-[16px] text-white">
							Add Strategy
						</h2>
						<p className="text-[12px] text-muted-foreground/60 mt-0.5">
							Choose a strategy to run on your dashboard
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-white/[0.06] transition-colors"
					>
						<X className="w-4 h-4 text-muted-foreground" />
					</button>
				</div>

				{/* Strategy List */}
				<div className="p-3 max-h-[60vh] overflow-y-auto space-y-2">
					{strategies.map((strategy) => {
						const isActive = activeStrategyIds.includes(strategy.id);
						const isExpanded = expandedId === strategy.id;

						return (
							<div
								key={strategy.id}
								className={cn(
									"rounded-lg border transition-colors",
									isActive
										? "border-emerald-500/30 bg-emerald-500/[0.03]"
										: "border-border bg-[#0d0d0d] hover:border-border/80",
								)}
							>
								<div className="flex items-start justify-between p-4">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<h3 className="font-medium text-[13px] text-white">
												{strategy.name}
											</h3>
											{isActive && (
												<span className="px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider bg-emerald-500/10 text-emerald-400">
													Running
												</span>
											)}
										</div>
										<p className="text-[12px] text-muted-foreground/70 mt-1">
											{strategy.description}
										</p>

										{/* Expand/Collapse how it works */}
										<button
											type="button"
											onClick={() =>
												setExpandedId(isExpanded ? null : strategy.id)
											}
											className="flex items-center gap-1 mt-2 text-[11px] text-blue-400/70 hover:text-blue-400 transition-colors"
										>
											<Info className="w-3 h-3" />
											How it works
											{isExpanded ? (
												<ChevronUp className="w-3 h-3" />
											) : (
												<ChevronDown className="w-3 h-3" />
											)}
										</button>

										{isExpanded && (
											<div className="mt-2 p-3 rounded-md bg-white/[0.02] border border-border/50">
												<p className="text-[11px] text-muted-foreground/80 leading-relaxed">
													{strategy.how_it_works}
												</p>
												{strategy.params &&
													Object.keys(strategy.params).length > 0 && (
														<div className="mt-2 pt-2 border-t border-border/30">
															<p className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider mb-1">
																Parameters
															</p>
															<div className="grid grid-cols-2 gap-1">
																{Object.entries(strategy.params).map(
																	([key, value]) => (
																		<div
																			key={key}
																			className="text-[10px] font-mono"
																		>
																			<span className="text-muted-foreground/40">
																				{key}:
																			</span>{" "}
																			<span className="text-muted-foreground/70">
																				{typeof value === "object"
																					? JSON.stringify(value)
																					: String(value)}
																			</span>
																		</div>
																	),
																)}
															</div>
														</div>
													)}
											</div>
										)}
									</div>

									<button
										type="button"
										onClick={() => onAdd(strategy.id)}
										disabled={isActive}
										className={cn(
											"flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors shrink-0 ml-3",
											isActive
												? "bg-white/[0.04] text-muted-foreground/40 cursor-not-allowed"
												: "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20",
										)}
									>
										<Play className="w-3 h-3" />
										{isActive ? "Active" : "Run"}
									</button>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
