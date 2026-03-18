import Link from "next/link";
import type { MoverItem } from "@/lib/services/homepage";
import type { MarketStatus } from "@/lib/utils/market-hours";

type Props = {
  movers: MoverItem[];
  marketStatus: MarketStatus;
};

export function MoversModule({ movers, marketStatus }: Props) {
  const isOpen = marketStatus === "open";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">
          {marketStatus === "pre_market" ? "Pre-Market" : "Today's Movers"}
        </h2>
        {isOpen ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
            {marketStatus === "pre_market" ? "As of last close" : "Closed"}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {movers.map((mover) => {
          const isPositive = mover.changePercent >= 0;
          return (
            <Link
              key={mover.symbol}
              href={`/ticker/${mover.symbol}`}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 transition hover:bg-zinc-50"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-zinc-900">
                  {mover.symbol}
                </span>
                <span className="text-xs text-zinc-500 truncate max-w-[180px]">
                  {mover.companyName}
                </span>
              </div>
              <div className="flex items-baseline gap-2 shrink-0 ml-4">
                <span className="text-xs text-zinc-400">
                  ${mover.currentPrice.toFixed(2)}
                </span>
                <span
                  className={`text-sm font-medium tabular-nums ${
                    isPositive ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {mover.changePercent.toFixed(2)}%
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
