import { TickerSearch } from "@/components/ticker-search";
import Link from "next/link";

const EXAMPLE_TICKERS = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META"];

export default function HomePage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
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

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {EXAMPLE_TICKERS.map((ticker) => (
          <Link
            key={ticker}
            href={`/ticker/${ticker}`}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
          >
            {ticker}
          </Link>
        ))}
      </div>
    </div>
  );
}
