"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  variant?: "default" | "success" | "warning" | "danger";
  compact?: boolean;
}

const variantStyles = {
  default: {
    icon: "text-muted-foreground",
    iconBg: "bg-muted/50",
    value: "text-foreground",
  },
  success: {
    icon: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
    value: "text-emerald-400",
  },
  warning: {
    icon: "text-amber-400",
    iconBg: "bg-amber-500/10",
    value: "text-amber-400",
  },
  danger: {
    icon: "text-red-400",
    iconBg: "bg-red-500/10",
    value: "text-red-400",
  },
};

export function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  variant = "default",
  compact = false,
}: StatCardProps) {
  const styles = variantStyles[variant];

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <Icon className={cn("size-4 shrink-0", styles.icon)} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("text-sm font-semibold tabular-nums", styles.value)}>
            {value}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-lg shrink-0",
              styles.iconBg,
            )}
          >
            <Icon className={cn("size-4", styles.icon)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p
              className={cn(
                "text-lg font-semibold tabular-nums leading-tight",
                styles.value,
              )}
            >
              {value}
            </p>
            {subtitle && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground/60">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
