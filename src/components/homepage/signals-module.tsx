import Link from "next/link";
import type { SignalItem } from "@/lib/services/homepage";
import { Sparkline } from "@/components/chart/sparkline";

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type Props = {
  signals: SignalItem[];
};

export function SignalsModule({ signals }: Props) {
  if (signals.length === 0) return null;

  return (
    <div>
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-zinc-900">Strong signals</span>
        <span className="text-[12px] text-zinc-400">AI-explained moves with high confidence</span>
      </div>

      <div className="flex flex-col gap-2">
        {signals.map((signal) => {
          const hasSparkline = signal.intradayData && signal.intradayData.length >= 2;
          const sparkIsPositive = hasSparkline
            ? signal.intradayData![signal.intradayData!.length - 1].price >=
              signal.intradayData![0].price
            : true;
          const isPositive =
            signal.changePercent !== undefined ? signal.changePercent >= 0 : sparkIsPositive;

          return (
            <Link
              key={`${signal.symbol}-${signal.timestamp}`}
              href={`/ticker/${signal.symbol}`}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              {/* Symbol + pill + summary */}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[13px] font-medium text-zinc-900">
                    {signal.symbol}
                  </span>
                  {signal.changePercent !== undefined && (
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        isPositive
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {signal.changePercent.toFixed(2)}%
                    </span>
                  )}
                </div>
                <p className="truncate text-[12px] leading-snug text-zinc-500">
                  {signal.summary}
                </p>
              </div>

              {/* Sparkline */}
              {hasSparkline && (
                <Sparkline
                  data={signal.intradayData!}
                  isPositive={sparkIsPositive}
                  width={56}
                  height={28}
                />
              )}

              {/* Timestamp */}
              <span className="shrink-0 text-[11px] text-zinc-400">
                {timeAgo(signal.timestamp)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
