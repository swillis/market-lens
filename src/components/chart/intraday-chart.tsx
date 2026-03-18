"use client";

import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts";
import type { IntradayPoint } from "@/lib/services/intraday";

type Props = {
  data: IntradayPoint[];
  isPositive: boolean;
  height?: number;
};

const SESSION_MINUTES = 390; // 9:30 AM → 4:00 PM ET

export function IntradayChart({ data, isPositive, height = 160 }: Props) {
  if (!data || data.length < 2) return null;

  const color = isPositive ? "#16a34a" : "#dc2626";
  const gradientId = isPositive ? "intraday-pos" : "intraday-neg";

  // Map points to numeric timestamps so XAxis can hold a fixed domain.
  const chartData = data.map((p) => ({
    price: p.price,
    ts: new Date(p.time).getTime(),
  }));

  // First bar is always 9:30 AM ET (includePrePost:false). Extend domain to
  // 4:00 PM ET so the line only reaches the current time, leaving the rest empty.
  const sessionOpenMs  = chartData[0].ts;
  const sessionCloseMs = sessionOpenMs + SESSION_MINUTES * 60 * 1000;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="ts"
          type="number"
          domain={[sessionOpenMs, sessionCloseMs]}
          hide
        />
        <YAxis domain={["auto", "auto"]} hide />
        <Area
          type="linear"
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
