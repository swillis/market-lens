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
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-zinc-900">Strong Signals</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          AI-explained moves with high confidence
        </p>
      </div>

      <div className="space-y-3">
        {signals.map((signal) => {
          const hasSparkline = signal.intradayData && signal.intradayData.length >= 2;
          const sparkIsPositive = hasSparkline
            ? signal.intradayData![signal.intradayData!.length - 1].price >=
              signal.intradayData![0].price
            : true;

          return (
            <Link
              key={`${signal.symbol}-${signal.timestamp}`}
              href={`/ticker/${signal.symbol}`}
              className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-900">
                  {signal.symbol}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {hasSparkline && (
                    <Sparkline
                      data={signal.intradayData!}
                      isPositive={sparkIsPositive}
                      width={64}
                      height={28}
                    />
                  )}
                  <span className="text-xs text-zinc-400">
                    {timeAgo(signal.timestamp)}
                  </span>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-zinc-500 line-clamp-2">
                {signal.summary}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
