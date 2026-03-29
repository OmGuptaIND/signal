import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
	label: string;
	value: string | number;
	icon: LucideIcon;
	variant?: "default" | "success" | "warning" | "danger";
	subtitle?: string;
}

const variantStyles = {
	default: {
		iconBg: "bg-white/[0.06]",
		iconColor: "text-muted-foreground",
		valueColor: "text-white",
	},
	success: {
		iconBg: "bg-emerald-500/10",
		iconColor: "text-emerald-400",
		valueColor: "text-emerald-400",
	},
	warning: {
		iconBg: "bg-amber-500/10",
		iconColor: "text-amber-400",
		valueColor: "text-amber-400",
	},
	danger: {
		iconBg: "bg-red-500/10",
		iconColor: "text-red-400",
		valueColor: "text-red-400",
	},
};

export function StatCard({
	label,
	value,
	icon: Icon,
	variant = "default",
	subtitle,
}: StatCardProps) {
	const styles = variantStyles[variant];

	return (
		<div className="flex items-start gap-3 rounded-lg border border-border bg-[#111111] p-4 animate-fade-in">
			<div
				className={cn(
					"flex items-center justify-center w-8 h-8 rounded-md shrink-0",
					styles.iconBg,
				)}
			>
				<Icon className={cn("w-4 h-4", styles.iconColor)} />
			</div>
			<div className="min-w-0">
				<p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
					{label}
				</p>
				<p
					className={cn(
						"text-lg font-semibold tracking-tight mt-0.5 font-mono",
						styles.valueColor,
					)}
				>
					{value}
				</p>
				{subtitle && (
					<p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">
						{subtitle}
					</p>
				)}
			</div>
		</div>
	);
}
