"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Signal } from "@/lib/api-types";

interface IndexBreakdownProps {
  signals: Signal[];
}

export function IndexBreakdown({ signals }: IndexBreakdownProps) {
  const data = useMemo(() => {
    const grouped: Record<string, { long: number; short: number; neutral: number }> = {};

    for (const s of signals) {
      if (!grouped[s.index_name]) {
        grouped[s.index_name] = { long: 0, short: 0, neutral: 0 };
      }
      const g = grouped[s.index_name];
      if (g) {
        if (s.signal === "LONG_BIAS") g.long++;
        else if (s.signal === "SHORT_BIAS") g.short++;
        else g.neutral++;
      }
    }

    return Object.entries(grouped).map(([name, counts]) => ({
      name,
      Long: counts.long,
      Short: counts.short,
      Neutral: counts.neutral,
    }));
  }, [signals]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Index Breakdown</CardTitle>
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
        <CardTitle className="text-sm font-medium">Index Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(var(--foreground))",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px" }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="Long" fill="#34d399" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Short" fill="#f87171" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Neutral" fill="#fbbf24" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
