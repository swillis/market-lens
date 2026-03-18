import { TickerSearch } from "@/components/ticker-search";
import { MoversModule } from "@/components/homepage/movers-module";
import { SignalsModule } from "@/components/homepage/signals-module";
import { WatchlistModule } from "@/components/homepage/watchlist-module";
import { getMarketStatus } from "@/lib/utils/market-hours";
import { fetchHomepageData } from "@/lib/services/homepage";

export const revalidate = 300; // 5 minutes

export default async function HomePage() {
  const { status } = getMarketStatus();
  const { movers, signals, watchlist } = await fetchHomepageData();

  const isOpen = status === "open";
  const isClosedOrAfter = status === "closed" || status === "after_hours";
  const isPreMarket = status === "pre_market";

  return (
    <div className="flex flex-col items-center">
      {/* Hero — search box, always visible */}
      <div className="flex min-h-[40vh] w-full flex-col items-center justify-center py-16">
        <div className="mb-2 text-sm font-medium uppercase tracking-widest text-zinc-500">
          Stock Move Explainer
        </div>
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-white">
          Market Lens
        </h1>
        <p className="mb-8 max-w-md text-center text-zinc-400">
          Type a ticker to understand why a stock is moving today.
          AI-powered analysis backed by real-time news.
        </p>
        <TickerSearch />
      </div>

      {/* Market-aware modules */}
      <div className="w-full max-w-3xl space-y-6 pb-16">
        {/* MARKET OPEN */}
        {isOpen && (
          <>
            {movers && movers.length > 0 && (
              <MoversModule movers={movers} marketStatus={status} />
            )}
            {signals.length > 0 && (
              <SignalsModule signals={signals} />
            )}
          </>
        )}

        {/* MARKET CLOSED / AFTER HOURS */}
        {isClosedOrAfter && (
          <>
            {movers && movers.length > 0 && (
              <MoversModule movers={movers} marketStatus={status} />
            )}
            {watchlist && watchlist.length > 0 && (
              <WatchlistModule items={watchlist} marketStatus={status} />
            )}
            {signals.length > 0 && (
              <SignalsModule signals={signals} />
            )}
          </>
        )}

        {/* PRE-MARKET */}
        {isPreMarket && (
          <>
            {movers && movers.length > 0 && (
              <MoversModule movers={movers} marketStatus={status} />
            )}
            {watchlist && watchlist.length > 0 && (
              <WatchlistModule items={watchlist} marketStatus={status} />
            )}
            {signals.length > 0 && (
              <SignalsModule signals={signals} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
