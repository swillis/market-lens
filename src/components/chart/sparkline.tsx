"use client";

import { LineChart, Line, XAxis, YAxis } from "recharts";
import type { IntradayPoint } from "@/lib/services/intraday";

type Props = {
  data: IntradayPoint[];
  isPositive: boolean;
  width?: number;
  height?: number;
};

const SESSION_MINUTES = 390; // 9:30 AM → 4:00 PM ET

export function Sparkline({ data, isPositive, width = 64, height = 28 }: Props) {
  if (!data || data.length < 2) {
    return (
      <div style={{ width, height }} className="flex items-center">
        <div className="w-full h-px bg-zinc-200" />
      </div>
    );
  }

  const color = isPositive ? "#16a34a" : "#dc2626";

  const chartData = data.map((p) => ({
    price: p.price,
    ts: new Date(p.time).getTime(),
  }));

  const sessionOpenMs  = chartData[0].ts;
  const sessionCloseMs = sessionOpenMs + SESSION_MINUTES * 60 * 1000;

  return (
    <LineChart
      width={width}
      height={height}
      data={chartData}
      margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
    >
      <XAxis
        dataKey="ts"
        type="number"
        domain={[sessionOpenMs, sessionCloseMs]}
        hide
      />
      <YAxis domain={["auto", "auto"]} hide />
      <Line
        type="linear"
        dataKey="price"
        stroke={color}
        strokeWidth={1.5}
        dot={false}
        activeDot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
