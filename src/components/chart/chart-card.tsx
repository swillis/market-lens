"use client";

import { IntradayChart } from "./intraday-chart";
import type { IntradayPoint } from "@/lib/services/intraday";

type Props = {
  data: IntradayPoint[];
  isPositive: boolean;
};

export function ChartCard({ data, isPositive }: Props) {
  if (!data || data.length < 2) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-6 pt-4 pb-2">
      <div className="flex justify-end mb-1">
        <span className="text-xs text-zinc-400">Today</span>
      </div>
      <IntradayChart data={data} isPositive={isPositive} height={160} />
    </div>
  );
}
