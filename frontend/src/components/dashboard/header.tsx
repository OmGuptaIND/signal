"use client";

import { CheckCircle2, Link as LinkIcon, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActiveRun, AuthStatus } from "@/store";

interface HeaderProps {
	authStatus: AuthStatus | null;
	activeRun: ActiveRun | null;
	signalCount: number;
	onConnect: () => void;
}

export function Header({
	authStatus,
	activeRun,
	signalCount,
	onConnect,
}: HeaderProps) {
	const isConnected = authStatus?.is_connected ?? false;

	return (
		<header className="flex h-14 shrink-0 items-center justify-between border-border border-b bg-[#0a0a0a] px-6">
			{/* Left: Title */}
			<div className="flex items-center gap-3">
				<h1 className="font-semibold text-[14px] text-white tracking-tight">
					Live Terminal
				</h1>
				<Badge
					className="h-5 border-border font-mono text-[11px] text-muted-foreground"
					variant="outline"
				>
					{signalCount} signals
				</Badge>
				<Badge
					className="h-5 border-border font-mono text-[11px] text-muted-foreground"
					variant="outline"
				>
					Run: {activeRun?.status ?? "idle"}
				</Badge>
			</div>

			{/* Right: Auth */}
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-2">
					{isConnected ? (
						<div className="flex items-center gap-1.5 text-[12px] text-emerald-400">
							<CheckCircle2 className="h-3.5 w-3.5" />
							<span className="font-medium">Connected</span>
						</div>
					) : (
						<>
							<div className="flex items-center gap-1.5 text-[12px] text-red-400">
								<XCircle className="h-3.5 w-3.5" />
								<span className="font-medium">Disconnected</span>
							</div>
							<Button
								className="h-7 bg-white px-3 font-medium text-[12px] text-black hover:bg-white/90"
								onClick={onConnect}
								size="xs"
							>
								<LinkIcon className="mr-1.5 h-3 w-3" />
								Connect Kite
							</Button>
						</>
					)}
				</div>
			</div>
		</header>
	);
}
