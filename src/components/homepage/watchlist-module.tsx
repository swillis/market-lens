import Link from "next/link";
import type { WatchItem } from "@/lib/services/homepage";
import type { MarketStatus } from "@/lib/utils/market-hours";

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hrs = diff / 3600000;

  if (hrs < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (hrs < 24) return `${Math.floor(hrs)}h ago`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Props = {
  items: WatchItem[];
  marketStatus: MarketStatus;
};

export function WatchlistModule({ items, marketStatus }: Props) {
  if (items.length === 0) return null;

  const isPreMarket = marketStatus === "pre_market";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-zinc-900">What to Watch</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          {isPreMarket
            ? "Pre-market catalysts for today"
            : "Pre-market catalysts for tomorrow"}
        </p>
      </div>

      <div className="space-y-1">
        {items.map((item, i) => (
          <Link
            key={`${item.symbol}-${i}`}
            href={`/ticker/${item.symbol}`}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition hover:bg-zinc-50"
          >
            <span className="mt-0.5 shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-zinc-600">
              {item.symbol}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-zinc-600">{item.headline}</p>
              <div className="mt-1 flex items-center gap-2">
                {item.type === "earnings" ? (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                    Earnings
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400">{item.source}</span>
                )}
                <span className="text-xs text-zinc-400">
                  {formatDate(item.publishedAt)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
