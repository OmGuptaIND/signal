import { cn } from "@/lib/utils";

interface StatusDotProps {
	status: "online" | "warning" | "offline" | "idle";
	pulse?: boolean;
	size?: "sm" | "md";
}

const dotColors = {
	online: "bg-emerald-400",
	warning: "bg-amber-400",
	offline: "bg-red-400",
	idle: "bg-muted-foreground/50",
};

const pingColors = {
	online: "bg-emerald-400",
	warning: "bg-amber-400",
	offline: "bg-red-400",
	idle: "bg-muted-foreground/50",
};

export function StatusDot({
	status,
	pulse = false,
	size = "sm",
}: StatusDotProps) {
	const dimension = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";

	return (
		<span className={cn("relative flex", dimension)}>
			{pulse && (
				<span
					className={cn(
						"animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
						pingColors[status],
					)}
				/>
			)}
			<span
				className={cn(
					"relative inline-flex rounded-full",
					dimension,
					dotColors[status],
				)}
			/>
		</span>
	);
}
