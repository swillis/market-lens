import Link from "next/link";
import type { MoverItem, SignalItem } from "@/lib/services/homepage";
import type { MarketStatus } from "@/lib/utils/market-hours";
import { Sparkline } from "@/components/chart/sparkline";
import { WATCHLIST } from "@/lib/services/homepage";

type Props = {
  movers: MoverItem[];
  signals: SignalItem[];
  marketStatus: MarketStatus;
};

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MoversModule({ movers, signals, marketStatus }: Props) {
  const signalMap = new Map(signals.map((s) => [s.symbol, s.summary]));
  const remaining = WATCHLIST.length - movers.length;

  return (
    <div>
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-zinc-900">
          {marketStatus === "pre_market" ? "Pre-market moves" : "Today's moves"}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-widest text-zinc-400">
          {formatDate()}
        </span>
      </div>

      {/* Horizontal scroll row */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {movers.map((mover) => {
          const isPositive = mover.changePercent >= 0;
          const reason = signalMap.get(mover.symbol);
          const shortReason = reason
            ? reason.length > 55 ? reason.slice(0, 52) + "…" : reason
            : null;

          return (
            <Link
              key={mover.symbol}
              href={`/ticker/${mover.symbol}`}
              className="min-w-[140px] flex-shrink-0 rounded-xl border border-zinc-200 bg-white p-3 transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              {/* Ticker + pill */}
              <div className="mb-2 flex items-start justify-between gap-1">
                <span className="text-[13px] font-medium text-zinc-900">
                  {mover.symbol}
                </span>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    isPositive
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {mover.changePercent.toFixed(1)}%
                </span>
              </div>

              {/* Sparkline */}
              {mover.intradayData && mover.intradayData.length >= 2 ? (
                <Sparkline
                  data={mover.intradayData}
                  isPositive={isPositive}
                  width={112}
                  height={32}
                />
              ) : (
                <div className="flex h-8 items-center">
                  <div className="h-px w-full bg-zinc-200" />
                </div>
              )}

              {/* One-line reason */}
              {shortReason && (
                <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">
                  {shortReason}
                </p>
              )}
            </Link>
          );
        })}

        {/* "+ N more" overflow card */}
        {remaining > 0 && (
          <div className="flex min-w-[100px] flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-transparent px-4">
            <span className="text-[12px] text-zinc-400">+ {remaining} more</span>
          </div>
        )}
      </div>

      <p className="mt-2 text-[11px] text-zinc-400">
        Tap any card to see the full explanation
      </p>
    </div>
  );
}
