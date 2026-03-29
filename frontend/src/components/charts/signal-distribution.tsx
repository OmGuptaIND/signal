"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Signal } from "@/lib/api-types";

interface SignalDistributionProps {
  signals: Signal[];
}

const COLORS = {
  LONG_BIAS: "#34d399",
  SHORT_BIAS: "#f87171",
  NEUTRAL: "#fbbf24",
};

export function SignalDistribution({ signals }: SignalDistributionProps) {
  const data = useMemo(() => {
    const counts = { LONG_BIAS: 0, SHORT_BIAS: 0, NEUTRAL: 0 };
    for (const s of signals) {
      if (s.signal in counts) counts[s.signal]++;
    }
    return [
      { name: "Long", value: counts.LONG_BIAS, fill: COLORS.LONG_BIAS },
      { name: "Short", value: counts.SHORT_BIAS, fill: COLORS.SHORT_BIAS },
      { name: "Neutral", value: counts.NEUTRAL, fill: COLORS.NEUTRAL },
    ].filter((d) => d.value > 0);
  }, [signals]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Signal Distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <p className="text-xs text-muted-foreground">No signal data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Signal Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "hsl(var(--foreground))",
                }}
                formatter={(value, name) => [value, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="mt-2 flex items-center justify-center gap-4 text-xs">
          {data.map((d) => (
            <span key={d.name} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: d.fill }}
              />
              {d.name} ({d.value})
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
