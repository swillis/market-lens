"use client";

import { AreaChart, Area } from "recharts";
import type { IntradayPoint } from "@/lib/services/intraday";

type Props = {
  data: IntradayPoint[];
  isPositive: boolean;
  width?: number;
  height?: number;
};

export function Sparkline({ data, isPositive, width = 64, height = 28 }: Props) {
  if (!data || data.length < 2) {
    return (
      <div style={{ width, height }} className="flex items-center">
        <div className="w-full h-px bg-zinc-200" />
      </div>
    );
  }

  const color = isPositive ? "#16a34a" : "#dc2626";
  // Use symbol-stable gradient IDs — SVG IDs are document-global so same color
  // sparklines can safely share the same gradient definition.
  const gradientId = `spark-${isPositive ? "pos" : "neg"}`;

  return (
    <AreaChart
      width={width}
      height={height}
      data={data}
      margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
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
  );
}
