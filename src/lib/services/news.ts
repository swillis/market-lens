import type { NewsArticle } from "@/lib/types/market";
import { getMockNews } from "./mock-data";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { finnhubNewsArraySchema } from "@/lib/schemas/api-responses";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

export async function fetchNews(symbol: string): Promise<NewsArticle[]> {
  if (process.env.USE_MOCK_DATA === "true" || !process.env.FINNHUB_API_KEY) {
    return getMockNews(symbol);
  }

  try {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 72 * 3600000);
    const from = threeDaysAgo.toISOString().split("T")[0];
    const to = now.toISOString().split("T")[0];

    const url = `${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`;
    const res = await fetchWithTimeout(url, { timeout: 8000, next: { revalidate: 300 } } as RequestInit & { timeout?: number });

    if (!res.ok) {
      console.warn(`News fetch failed for ${symbol}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const parsed = finnhubNewsArraySchema.safeParse(data);

    if (!parsed.success) {
      console.warn(`News validation failed for ${symbol}: ${parsed.error.message}`);
      return [];
    }

    return parsed.data.slice(0, 10).map((item) => ({
      title: item.headline,
      source: item.source,
      publishedAt: item.datetime
        ? new Date(item.datetime * 1000).toISOString()
        : new Date().toISOString(),
      url: item.url,
      summary: item.summary || undefined,
      relatedSymbols: item.related ? item.related.split(",") : [symbol],
    }));
  } catch (err) {
    console.warn(`News fetch error for ${symbol}:`, err);
    return [];
  }
}
