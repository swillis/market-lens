/**
 * Homepage data fetching service.
 * All functions are designed to fail gracefully — a failure in any
 * individual fetch returns null/[] rather than throwing.
 */

import { getMockPrice, getMockCompany } from "./mock-data";
import { getAllSnapshots } from "./snapshot-store";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { fmpQuoteSchema } from "@/lib/schemas/api-responses";
import { fetchIntradayData, type IntradayPoint } from "./intraday";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------

export const WATCHLIST = [
  "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "NFLX",
  "AMD", "AVGO", "JPM", "GS", "BAC", "V", "MA", "UNH", "JNJ", "XOM",
  "WMT", "DIS",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MoverItem = {
  symbol: string;
  companyName: string;
  changePercent: number;
  currentPrice: number;
  intradayData?: IntradayPoint[];
};

export type SignalItem = {
  symbol: string;
  summary: string;      // truncated to 100 chars
  confidenceScore: number;
  timestamp: string;
  changePercent?: number;
  intradayData?: IntradayPoint[];
};

export type StoryItem = {
  headline: string;
  publishedAt: string;
  relatedTickers: Array<{ symbol: string; changePercent: number }>;
};

export type WatchItem = {
  symbol: string;
  headline: string;
  type: "news" | "earnings";
  source: string;       // news source name or "Earnings"
  publishedAt: string;  // ISO 8601
  intradayData?: IntradayPoint[];
};

// ---------------------------------------------------------------------------
// Intraday enrichment — fetches real hourly data via yahoo-finance2.
// Per-symbol failures set intradayData: [] rather than failing the whole list.
// ---------------------------------------------------------------------------

async function enrichWithIntraday<T extends { symbol: string }>(
  items: T[]
): Promise<(T & { intradayData: IntradayPoint[] })[]> {
  return Promise.all(
    items.map(async (item) => {
      try {
        const data = await fetchIntradayData(item.symbol);
        return { ...item, intradayData: data.points };
      } catch {
        return { ...item, intradayData: [] as IntradayPoint[] };
      }
    })
  );
}

// ---------------------------------------------------------------------------
// FMP batch quote schema (stable/quote supports comma-separated symbols)
// ---------------------------------------------------------------------------

const fmpBatchQuoteSchema = z.array(
  fmpQuoteSchema.extend({ name: z.string().optional() })
);

// ---------------------------------------------------------------------------
// fetchMovers — top 5 by absolute % change from the watchlist
// ---------------------------------------------------------------------------

export async function fetchMovers(): Promise<MoverItem[] | null> {
  const useMock =
    process.env.USE_MOCK_DATA === "true" || !process.env.FMP_API_KEY;

  if (useMock) {
    const rawItems: MoverItem[] = WATCHLIST.flatMap((sym) => {
      const p = getMockPrice(sym);
      const c = getMockCompany(sym);
      if (!p || !c) return [];
      return [{ symbol: sym, companyName: c.companyName, changePercent: p.changePercent, currentPrice: p.currentPrice }];
    });
    return enrichWithIntraday(sortAndSliceMovers(rawItems));
  }

  try {
    const symbols = WATCHLIST.join(",");
    const url = `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(symbols)}&apikey=${process.env.FMP_API_KEY}`;
    const res = await fetchWithTimeout(url, {
      timeout: 8000,
      next: { revalidate: 60 },
    } as RequestInit & { timeout?: number });

    if (!res.ok) {
      console.warn(`[homepage] FMP batch quote failed: ${res.status}`);
      // 402 = batch endpoint not on free plan — fall back to mock data
      if (res.status === 402 || res.status === 403) {
        const rawItems: MoverItem[] = WATCHLIST.flatMap((sym) => {
          const p = getMockPrice(sym);
          const c = getMockCompany(sym);
          if (!p || !c) return [];
          return [{ symbol: sym, companyName: c.companyName, changePercent: p.changePercent, currentPrice: p.currentPrice }];
        });
        return enrichWithIntraday(sortAndSliceMovers(rawItems));
      }
      return null;
    }

    const data = await res.json();
    const parsed = fmpBatchQuoteSchema.safeParse(data);
    if (!parsed.success) {
      console.warn("[homepage] FMP batch quote parse failed:", parsed.error.message);
      return null;
    }

    // Fetch company names — derive from mock-data as a lightweight lookup
    // (just for display names on the homepage, no extra API calls needed).
    const nameMap = Object.fromEntries(
      WATCHLIST.map((sym) => {
        const c = getMockCompany(sym);
        return [sym, c?.companyName ?? sym];
      })
    );

    const rawItems: MoverItem[] = parsed.data.map((q) => ({
      symbol: q.symbol,
      companyName: nameMap[q.symbol] ?? q.symbol,
      changePercent: q.changePercentage,
      currentPrice: q.price,
    }));

    return enrichWithIntraday(sortAndSliceMovers(rawItems));
  } catch (err) {
    console.warn("[homepage] fetchMovers error:", err);
    return null;
  }
}

function sortAndSliceMovers(items: MoverItem[]): MoverItem[] {
  return [...items]
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, 5);
}

// ---------------------------------------------------------------------------
// fetchHighConfidenceSignals — from snapshot store
// ---------------------------------------------------------------------------

export async function fetchHighConfidenceSignals(): Promise<SignalItem[]> {
  try {
    const all = await getAllSnapshots();
    const signals = all
      .filter((s) => s.confidenceLabel === "high")
      .slice(0, 4)
      .map((s) => ({
        symbol: s.symbol,
        summary: s.summary.length > 100 ? s.summary.slice(0, 97) + "…" : s.summary,
        confidenceScore: s.confidenceScore,
        timestamp: s.timestamp,
      }));
    return enrichWithIntraday(signals);
  } catch (err) {
    console.warn("[homepage] fetchHighConfidenceSignals error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Finnhub news schema (lightweight — just what we need)
// ---------------------------------------------------------------------------

const finnhubItemSchema = z.object({
  headline: z.string().optional().default("Untitled"),
  source: z.string().optional().default("Unknown"),
  datetime: z.number().optional(),
  related: z.string().optional(),
});
const finnhubArraySchema = z.array(finnhubItemSchema);

// FMP earnings calendar schema
const fmpEarningsSchema = z.array(
  z.object({
    symbol: z.string(),
    date: z.string(),
    eps: z.number().nullable().optional(),
  })
);

// ---------------------------------------------------------------------------
// fetchWatchlist — news + earnings for closed/pre-market states
// ---------------------------------------------------------------------------

export async function fetchWatchlist(): Promise<WatchItem[] | null> {
  if (!process.env.FINNHUB_API_KEY && process.env.USE_MOCK_DATA !== "true") {
    return null; // hide the module if no Finnhub key
  }
  if (process.env.USE_MOCK_DATA === "true") {
    return null; // hide in mock mode (no Finnhub data)
  }

  const results = await Promise.allSettled([
    fetchWatchlistNews(),
    fetchEarningsCalendar(),
  ]);

  const newsItems = results[0].status === "fulfilled" ? results[0].value : [];
  const earningsItems = results[1].status === "fulfilled" ? results[1].value : [];

  const combined = [...earningsItems, ...newsItems]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 6);

  if (combined.length === 0) return null;
  return enrichWithIntraday(combined);
}

async function fetchWatchlistNews(): Promise<WatchItem[]> {
  const now = new Date();
  const twelveHoursAgo = new Date(now.getTime() - 12 * 3600000);
  const from = twelveHoursAgo.toISOString().split("T")[0];
  const to = now.toISOString().split("T")[0];

  const items: WatchItem[] = [];

  // Fetch in small batches to avoid hammering the API — pick a subset
  const subset = WATCHLIST.slice(0, 8);
  const fetches = subset.map(async (sym) => {
    try {
      const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(sym)}&from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`;
      const res = await fetchWithTimeout(url, { timeout: 6000 } as RequestInit & { timeout?: number });
      if (!res.ok) return;
      const data = await res.json();
      const parsed = finnhubArraySchema.safeParse(data);
      if (!parsed.success) return;

      const article = parsed.data[0]; // most recent per symbol
      if (!article) return;

      const publishedAt = article.datetime
        ? new Date(article.datetime * 1000).toISOString()
        : new Date().toISOString();

      // Only include if within 12 hours
      if (new Date(publishedAt) < twelveHoursAgo) return;

      items.push({
        symbol: sym,
        headline: article.headline,
        type: "news",
        source: article.source,
        publishedAt,
      });
    } catch {
      // ignore per-symbol failure
    }
  });

  await Promise.allSettled(fetches);
  return items;
}

async function fetchEarningsCalendar(): Promise<WatchItem[]> {
  if (!process.env.FMP_API_KEY || process.env.USE_MOCK_DATA === "true") return [];

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    const url = `https://financialmodelingprep.com/stable/earnings-calendar?from=${dateStr}&to=${dateStr}&apikey=${process.env.FMP_API_KEY}`;
    const res = await fetchWithTimeout(url, { timeout: 6000, next: { revalidate: 3600 } } as RequestInit & { timeout?: number });
    if (!res.ok) return [];

    const data = await res.json();
    const parsed = fmpEarningsSchema.safeParse(data);
    if (!parsed.success) return [];

    const watchlistSet = new Set(WATCHLIST as readonly string[]);
    return parsed.data
      .filter((e) => watchlistSet.has(e.symbol))
      .slice(0, 4)
      .map((e) => ({
        symbol: e.symbol,
        headline: "Earnings report",
        type: "earnings" as const,
        source: "Earnings",
        publishedAt: new Date(e.date).toISOString(),
      }));
  } catch (err) {
    console.warn("[homepage] fetchEarningsCalendar error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// fetchAllWatchlistPrices — full 20-symbol price map for enrichment
// ---------------------------------------------------------------------------

async function fetchAllWatchlistPrices(): Promise<Map<string, number>> {
  const useMock =
    process.env.USE_MOCK_DATA === "true" || !process.env.FMP_API_KEY;

  if (useMock) {
    const map = new Map<string, number>();
    for (const sym of WATCHLIST) {
      const p = getMockPrice(sym);
      if (p) map.set(sym, p.changePercent);
    }
    return map;
  }

  try {
    const symbols = WATCHLIST.join(",");
    const url = `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(symbols)}&apikey=${process.env.FMP_API_KEY}`;
    const res = await fetchWithTimeout(url, {
      timeout: 8000,
      next: { revalidate: 60 },
    } as RequestInit & { timeout?: number });

    if (!res.ok) {
      // Fall back to mock prices
      const map = new Map<string, number>();
      for (const sym of WATCHLIST) {
        const p = getMockPrice(sym);
        if (p) map.set(sym, p.changePercent);
      }
      return map;
    }

    const data = await res.json();
    const parsed = fmpBatchQuoteSchema.safeParse(data);
    if (!parsed.success) return new Map();

    return new Map(parsed.data.map((q) => [q.symbol, q.changePercentage]));
  } catch {
    return new Map();
  }
}

// ---------------------------------------------------------------------------
// fetchMarketStories — news items tagged with mentioned tickers
// ---------------------------------------------------------------------------

async function fetchMarketStories(
  priceMap: Map<string, number>
): Promise<StoryItem[]> {
  if (process.env.USE_MOCK_DATA === "true" || !process.env.FINNHUB_API_KEY) {
    return [];
  }

  try {
    const newsItems = await fetchWatchlistNews();

    const stories: StoryItem[] = newsItems
      .filter((item) => item.type === "news")
      .map((item) => {
        const seen = new Set<string>();
        // Always include the item's own symbol
        if (priceMap.has(item.symbol)) {
          seen.add(item.symbol);
        }
        // Scan headline for other WATCHLIST tickers
        for (const ticker of WATCHLIST) {
          if (!seen.has(ticker)) {
            const re = new RegExp(`\\b${ticker}\\b`, "i");
            if (re.test(item.headline) && priceMap.has(ticker)) {
              seen.add(ticker);
            }
          }
        }
        const relatedTickers = Array.from(seen).map((sym) => ({
          symbol: sym,
          changePercent: priceMap.get(sym)!,
        }));
        return { headline: item.headline, publishedAt: item.publishedAt, relatedTickers };
      })
      .filter((s) => s.relatedTickers.length > 0)
      .slice(0, 5);

    return stories;
  } catch (err) {
    console.warn("[homepage] fetchMarketStories error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Aggregate — called by the API route
// ---------------------------------------------------------------------------

export type HomepageData = {
  movers: MoverItem[] | null;
  signals: SignalItem[];
  watchlist: WatchItem[] | null;
  stories: StoryItem[];
};

export async function fetchHomepageData(): Promise<HomepageData> {
  const [movers, rawSignals, watchlist, priceMap] = await Promise.all([
    fetchMovers(),
    fetchHighConfidenceSignals(),
    fetchWatchlist(),
    fetchAllWatchlistPrices(),
  ]);

  const signals = rawSignals.map((s) => ({
    ...s,
    changePercent: priceMap.get(s.symbol),
  }));

  const stories = await fetchMarketStories(priceMap);

  return { movers, signals, watchlist, stories };
}
