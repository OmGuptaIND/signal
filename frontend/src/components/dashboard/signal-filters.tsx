"use client";

import { cn } from "@/lib/utils";
import type { SignalDirection } from "@/lib/api-types";

interface SignalFiltersProps {
  selectedIndex: string | null;
  selectedDirection: SignalDirection | null;
  onIndexChange: (index: string | null) => void;
  onDirectionChange: (direction: SignalDirection | null) => void;
  indices: string[];
}

export function SignalFilters({
  selectedIndex,
  selectedDirection,
  onIndexChange,
  onDirectionChange,
  indices,
}: SignalFiltersProps) {
  const directions: { value: SignalDirection | null; label: string }[] = [
    { value: null, label: "All" },
    { value: "LONG_BIAS", label: "Long" },
    { value: "SHORT_BIAS", label: "Short" },
    { value: "NEUTRAL", label: "Neutral" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Index filter */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
        <button
          type="button"
          onClick={() => onIndexChange(null)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            selectedIndex === null
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          All
        </button>
        {indices.map((idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onIndexChange(idx)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              selectedIndex === idx
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {idx}
          </button>
        ))}
      </div>

      {/* Direction filter */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
        {directions.map((d) => (
          <button
            key={d.label}
            type="button"
            onClick={() => onDirectionChange(d.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              selectedDirection === d.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
