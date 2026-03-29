"use client";

import { Activity, BarChart3, Settings, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
	{ label: "Dashboard", icon: BarChart3, active: false, href: "#" },
	{ label: "Live Terminal", icon: Zap, active: true, href: "#" },
	{ label: "Settings", icon: Settings, active: false, href: "#" },
];

interface SidebarProps {
	isConnected: boolean;
}

export function Sidebar({ isConnected }: SidebarProps) {
	return (
		<aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-[220px] border-r border-border bg-[#0a0a0a] z-50">
			{/* Brand */}
			<div className="flex items-center gap-2.5 px-5 h-14 border-b border-border shrink-0">
				<div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.06]">
					<Activity className="w-4 h-4 text-white" />
				</div>
				<span className="text-[13px] font-semibold text-white tracking-tight">
					Strategy Engine
				</span>
			</div>

			{/* Navigation */}
			<nav className="flex-1 px-3 py-4 space-y-0.5">
				<p className="px-2 mb-2 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest">
					Navigation
				</p>
				{navItems.map((item) => (
					<a
						key={item.label}
						href={item.href}
						className={cn(
							"flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] font-medium transition-colors",
							item.active
								? "bg-white/[0.08] text-white"
								: "text-muted-foreground hover:bg-white/[0.04] hover:text-white/80",
						)}
					>
						<item.icon className="w-4 h-4 shrink-0" />
						{item.label}
					</a>
				))}
			</nav>

			{/* Footer Status */}
			<div className="px-4 py-3 border-t border-border">
				<div className="flex items-center gap-2">
					<span className="relative flex h-2 w-2">
						{isConnected && (
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
						)}
						<span
							className={cn(
								"relative inline-flex rounded-full h-2 w-2",
								isConnected ? "bg-emerald-400" : "bg-red-400",
							)}
						/>
					</span>
					<span className="text-[11px] text-muted-foreground">
						Kite {isConnected ? "Connected" : "Disconnected"}
					</span>
				</div>
			</div>
		</aside>
	);
}
