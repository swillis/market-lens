import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { getMockPrice } from "./mock-data";
import type { PriceSnapshot } from "@/lib/types/market";

export type IntradayPoint = {
  time: string;  // ISO timestamp
  price: number; // close price
};

export type IntradayData = {
  symbol: string;
  points: IntradayPoint[];
  change: number;      // overall period change %
  isPositive: boolean;
  timeRange: "intraday" | "5d"; // drives the chart label ("Today" vs "5D")
};

// ---------------------------------------------------------------------------
// Mock curve — curved path from previousClose to currentPrice.
// Used in mock mode and as final fallback.
// Exported so homepage can build sparklines without extra API calls.
// ---------------------------------------------------------------------------

export function generateMockPoints(symbol: string): IntradayPoint[] {
  const mockPrice = getMockPrice(symbol);
  if (!mockPrice) return [];

  const { previousClose, currentPrice } = mockPrice;
  const today = new Date().toISOString().split("T")[0];
  const totalChange = currentPrice - previousClose;

  const hours = [9.5, 10.5, 11.5, 12.5, 13.5, 14.5];
  return hours.map((hour, i) => {
    const t = i / (hours.length - 1);
    // f(t) = t + 0.15·sin(πt) — anchored at 0 and 1, gentle arch in between
    const f = t + 0.15 * Math.sin(Math.PI * t);
    const price = +(previousClose + totalChange * f).toFixed(2);
    const hourInt = Math.floor(hour);
    const minuteInt = Math.round((hour - hourInt) * 60);
    const time = `${today}T${String(hourInt).padStart(2, "0")}:${String(minuteInt).padStart(2, "0")}:00.000Z`;
    return { time, price };
  });
}

// ---------------------------------------------------------------------------
// syntheticIntradayFromQuote — builds 4 real price anchors from quote data.
// prevClose → open → dayLow|dayHigh (the "drama" point) → currentPrice
// Zero extra API calls; uses fields already returned by /stable/quote.
// ---------------------------------------------------------------------------

export function syntheticIntradayFromQuote(price: PriceSnapshot): IntradayPoint[] {
  const { previousClose, currentPrice, open, dayLow, dayHigh } = price;
  if (!open) return [];

  const today = new Date().toISOString().split("T")[0];
  const isUp = currentPrice >= previousClose;
  // Show the intraday extreme that fits the overall direction
  const dramaPrice = isUp ? (dayHigh ?? currentPrice) : (dayLow ?? currentPrice);

  return [
    { time: `${today}T09:30:00.000Z`, price: previousClose },
    { time: `${today}T09:31:00.000Z`, price: open },
    { time: `${today}T12:00:00.000Z`, price: dramaPrice },
    { time: `${today}T16:00:00.000Z`, price: currentPrice },
  ];
}

// ---------------------------------------------------------------------------
// fetchEodData — 5-day daily closes via stable/historical-price-eod-light.
// Available on the FMP free tier (250 req/day).
// ---------------------------------------------------------------------------

export async function fetchEodData(symbol: string): Promise<IntradayData | null> {
  if (!process.env.FMP_API_KEY) return null;

  try {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 7); // 7 calendar days covers ~5 trading days
    const fromStr = from.toISOString().split("T")[0];
    const toStr = today.toISOString().split("T")[0];

    const url = `https://financialmodelingprep.com/stable/historical-price-eod-light?symbol=${encodeURIComponent(symbol)}&from=${fromStr}&to=${toStr}&apikey=${process.env.FMP_API_KEY}`;
    const res = await fetchWithTimeout(url, {
      timeout: 5000,
      next: { revalidate: 300 },
    } as RequestInit & { timeout?: number });

    if (!res.ok) {
      console.warn(`[intraday] EOD failed for ${symbol}: ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    // FMP returns newest first — sort chronologically
    const sorted = [...(data as { date: string; close: number }[])]
      .filter((d) => d.date && typeof d.close === "number")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (sorted.length < 2) return null;

    const points: IntradayPoint[] = sorted.map((d) => ({
      time: new Date(d.date).toISOString(),
      price: d.close,
    }));

    const first = points[0].price;
    const last = points[points.length - 1].price;
    const change = +((last - first) / first * 100).toFixed(2);

    return { symbol, points, change, isPositive: change >= 0, timeRange: "5d" };
  } catch (err) {
    console.warn(`[intraday] fetchEodData error for ${symbol}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// fetchIntradayData — public API used by the /api/intraday route.
// Chain: EOD 5-day (real, free tier) → synthetic from quote → mock curve
// ---------------------------------------------------------------------------

export async function fetchIntradayData(
  symbol: string,
  priceSnapshot?: PriceSnapshot
): Promise<IntradayData> {
  const useMock = process.env.USE_MOCK_DATA === "true" || !process.env.FMP_API_KEY;

  if (useMock) {
    const mockPrice = getMockPrice(symbol);
    const points = generateMockPoints(symbol);
    const change = mockPrice
      ? +((mockPrice.currentPrice - mockPrice.previousClose) / mockPrice.previousClose * 100).toFixed(2)
      : 0;
    return { symbol, points, change, isPositive: change >= 0, timeRange: "intraday" };
  }

  // 1. Try 5-day EOD (real daily data, free tier)
  const eod = await fetchEodData(symbol);
  if (eod && eod.points.length >= 2) return eod;

  // 2. Synthetic intraday from quote anchors (caller must supply price data)
  if (priceSnapshot) {
    const points = syntheticIntradayFromQuote(priceSnapshot);
    if (points.length >= 2) {
      const change = priceSnapshot.changePercent;
      return { symbol, points, change, isPositive: change >= 0, timeRange: "intraday" };
    }
  }

  // 3. No data available — return empty so the chart hides
  return { symbol, points: [], change: 0, isPositive: true, timeRange: "intraday" };
}
