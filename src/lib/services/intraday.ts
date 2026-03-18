import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

type YahooChartResult = {
  quotes: Array<{ date: Date; close: number | null }>;
};
import { getMockPrice } from "./mock-data";

export type IntradayPoint = {
  time: string;  // ISO timestamp
  price: number; // close price
};

export type IntradayData = {
  symbol: string;
  points: IntradayPoint[];
  change: number;      // overall day change % (last vs first point)
  isPositive: boolean;
};

// ---------------------------------------------------------------------------
// Mock curve — 6 hourly points from previousClose to currentPrice.
// Curved path using Math.sin for natural variation.
// Used when USE_MOCK_DATA=true.
// ---------------------------------------------------------------------------

function generateMockPoints(symbol: string): IntradayData {
  const mockPrice = getMockPrice(symbol);
  if (!mockPrice) return { symbol, points: [], change: 0, isPositive: true };

  const { previousClose, currentPrice } = mockPrice;
  const today = new Date().toISOString().split("T")[0];
  const totalChange = currentPrice - previousClose;

  const hours = [9.5, 10.5, 11.5, 12.5, 13.5, 14.5];
  const points: IntradayPoint[] = hours.map((hour, i) => {
    const t = i / (hours.length - 1);
    // f(t) = t + 0.15·sin(πt) — anchored at 0 and 1, gentle arch in between
    const f = t + 0.15 * Math.sin(Math.PI * t);
    const price = +(previousClose + totalChange * f).toFixed(2);
    const hourInt = Math.floor(hour);
    const minuteInt = Math.round((hour - hourInt) * 60);
    const time = `${today}T${String(hourInt).padStart(2, "0")}:${String(minuteInt).padStart(2, "0")}:00.000Z`;
    return { time, price };
  });

  const change = +((currentPrice - previousClose) / previousClose * 100).toFixed(2);
  return { symbol, points, change, isPositive: change >= 0 };
}

// ---------------------------------------------------------------------------
// fetchIntradayData — public API used by the /api/intraday route and homepage.
// Uses yahoo-finance2 chart() for real hourly OHLCV.
// Falls back to mock data in mock mode; returns empty points on error.
// ---------------------------------------------------------------------------

export async function fetchIntradayData(symbol: string): Promise<IntradayData> {
  if (process.env.USE_MOCK_DATA === "true") {
    return generateMockPoints(symbol);
  }

  try {
    // Fetch 5 days of regular-session bars. includePrePost:false strips pre/after-hours
    // so every bar is within the 9:30–16:00 ET window.
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const result = await yahooFinance.chart(symbol, {
      period1: fiveDaysAgo,
      interval: "5m",
      includePrePost: false,
    }) as unknown as YahooChartResult;

    const quotes = result.quotes ?? [];

    // Group bars by their ET calendar date (en-CA → "YYYY-MM-DD", naturally sortable).
    const byDate = new Map<string, IntradayPoint[]>();
    for (const q of quotes) {
      if (q.close == null) continue;
      const dateKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
      }).format(q.date);
      const point: IntradayPoint = {
        time: new Date(q.date).toISOString(),
        price: q.close as number,
      };
      const bucket = byDate.get(dateKey);
      if (bucket) bucket.push(point);
      else byDate.set(dateKey, [point]);
    }

    const sortedDates = [...byDate.keys()].sort(); // ascending YYYY-MM-DD
    const todayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
    }).format(new Date());
    const todayBars = byDate.get(todayKey) ?? [];

    // Use today's bars if the session has started; otherwise show the last complete session.
    // This matches the Apple Stocks widget: growing line today, full previous day otherwise.
    const selectedBars =
      todayBars.length >= 2
        ? todayBars
        : (byDate.get(sortedDates[sortedDates.length - 1]) ?? []);

    if (selectedBars.length < 2) {
      return { symbol, points: [], change: 0, isPositive: true };
    }

    // Points are already in chronological order (yahoo returns them ascending).
    const first = selectedBars[0].price;
    const last = selectedBars[selectedBars.length - 1].price;
    const change = +((last - first) / first * 100).toFixed(2);

    return { symbol, points: selectedBars, change, isPositive: change >= 0 };
  } catch {
    return { symbol, points: [], change: 0, isPositive: true };
  }
}
