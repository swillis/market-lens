import type { PriceSnapshot } from "@/lib/types/market";
import { getMockPrice } from "./mock-data";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { fmpQuoteArraySchema } from "@/lib/schemas/api-responses";
import {
  tickerNotFound,
  apiTimeout,
  apiRateLimited,
  apiUnavailable,
  validationFailed,
} from "@/lib/errors";

const FMP_BASE = "https://financialmodelingprep.com/stable";

export async function fetchPriceSnapshot(
  symbol: string
): Promise<PriceSnapshot> {
  if (process.env.USE_MOCK_DATA === "true" || !process.env.FMP_API_KEY) {
    const mock = getMockPrice(symbol);
    if (!mock) throw tickerNotFound(symbol);
    return mock;
  }

  let res: Response;
  try {
    const url = `${FMP_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${process.env.FMP_API_KEY}`;
    res = await fetchWithTimeout(url, { timeout: 5000, next: { revalidate: 60 } } as RequestInit & { timeout?: number });
  } catch (err) {
    if (err instanceof DOMException || (err instanceof Error && err.name === "TimeoutError")) {
      throw apiTimeout("FMP", symbol);
    }
    throw err;
  }

  if (!res.ok) {
    if (res.status === 429) throw apiRateLimited("FMP");
    throw apiUnavailable("FMP", res.status);
  }

  const data = await res.json();
  const parsed = fmpQuoteArraySchema.safeParse(data);

  if (!parsed.success) {
    if (Array.isArray(data) && data.length === 0) {
      throw tickerNotFound(symbol);
    }
    throw validationFailed("FMP", parsed.error.message);
  }

  const quote = parsed.data[0];
  return {
    symbol: quote.symbol,
    currentPrice: quote.price,
    previousClose: quote.previousClose,
    change: quote.change,
    changePercent: quote.changePercentage,
    currency: "USD",
    asOf: new Date().toISOString(),
    open: quote.open,
    dayLow: quote.dayLow,
    dayHigh: quote.dayHigh,
  };
}
