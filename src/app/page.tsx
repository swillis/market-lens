import { TickerSearch } from "@/components/ticker-search";
import { MoversModule } from "@/components/homepage/movers-module";
import { SignalsModule } from "@/components/homepage/signals-module";
import { MarketStoriesSection } from "@/components/homepage/market-stories-section";
import { getMarketStatus } from "@/lib/utils/market-hours";
import { fetchHomepageData } from "@/lib/services/homepage";

export const revalidate = 300; // 5 minutes

export default async function HomePage() {
  const { status } = getMarketStatus();
  const { movers, signals, stories } = await fetchHomepageData();

  return (
    <div className="flex flex-col items-center">
      {/* Compact hero */}
      <div className="w-full max-w-3xl px-4 pt-10 pb-8 text-center">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
          Stock move explainer
        </p>
        <h1 className="mb-6 text-[28px] font-medium tracking-tight text-zinc-900">
          Market Lens
        </h1>
        <TickerSearch />
      </div>

      {/* Three sections */}
      <div className="w-full max-w-3xl space-y-6 px-4 pb-16">
        {movers && movers.length > 0 && (
          <MoversModule movers={movers} signals={signals} marketStatus={status} />
        )}
        {signals.length > 0 && (
          <SignalsModule signals={signals} />
        )}
        {stories.length > 0 && (
          <MarketStoriesSection stories={stories} />
        )}
      </div>
    </div>
  );
}
