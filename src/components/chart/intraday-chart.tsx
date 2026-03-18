"use client";

import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts";
import type { IntradayPoint } from "@/lib/services/intraday";

type Props = {
  data: IntradayPoint[];
  isPositive: boolean;
  height?: number;
};

export function IntradayChart({ data, isPositive, height = 160 }: Props) {
  if (!data || data.length < 2) return null;

  const color = isPositive ? "#16a34a" : "#dc2626";
  const gradientId = isPositive ? "intraday-pos" : "intraday-neg";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" hide />
        <YAxis domain={["auto", "auto"]} hide />
        <Area
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
