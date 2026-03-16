import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

interface FMPSearchResult {
  symbol: string;
  name: string;
  currency: string;
  stockExchange: string;
  exchangeShortName: string;
}

// Comprehensive list of common US stocks for fallback
const COMMON_TICKERS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "GOOG",
  "AMZN",
  "NVDA",
  "TSLA",
  "META",
  "AVGO",
  "ASML",
  "NFLX",
  "INTC",
  "AMD",
  "QCOM",
  "CSCO",
  "CRM",
  "ADBE",
  "PYPL",
  "SHOP",
  "UBER",
  "LYFT",
  "COIN",
  "HOOD",
  "PLTR",
  "SOFI",
  "RIOT",
  "MARA",
  "CLSK",
  "MSTR",
  "SQ",
  "ABNB",
  "DASH",
  "DOCS",
  "DDOG",
  "CRWD",
  "NET",
  "OKTA",
  "AUTH",
  "SNOW",
  "UPST",
  "RBLX",
  "ZM",
  "ROKU",
  "TTD",
  "PINC",
  "MOMO",
  "IQ",
  "NTES",
  "BIDU",
  "TCEHY",
  "BABA",
  "PDD",
  "XPEV",
  "NIO",
  "LI",
  "RIVN",
  "F",
  "GM",
  "TM",
  "HMC",
  "BMW",
  "FCAU",
];

export async function searchTickers(query: string): Promise<string[]> {
  // Default tickers if no query
  const DEFAULT = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN"];

  if (!query || query.trim().length === 0) {
    return DEFAULT;
  }

  const q = query.toUpperCase().trim();

  // Try FMP API first if key is available
  if (process.env.FMP_API_KEY) {
    try {
      const url = `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(q)}&apikey=${process.env.FMP_API_KEY}`;

      const res = await fetchWithTimeout(url, {
        timeout: 5000,
        next: { revalidate: 300 }, // Revalidate every 5 minutes
      } as RequestInit & { timeout?: number });

      if (res.ok) {
        const data = await res.json();
        if (data.results && Array.isArray(data.results)) {
          // Filter for stocks only and extract symbols
          const symbols = data.results
            .filter(
              (r: FMPSearchResult) =>
                r.exchangeShortName && r.symbol && r.symbol.length <= 5
            )
            .map((r: FMPSearchResult) => r.symbol)
            .slice(0, 10);

          if (symbols.length > 0) {
            return symbols;
          }
        }
      }
    } catch (error) {
      console.error("FMP API error:", error);
      // Fall through to fallback
    }
  }

  // Fallback: search common tickers list
  const exactMatches = COMMON_TICKERS.filter((t) => t.startsWith(q)).slice(
    0,
    10
  );
  const partialMatches = COMMON_TICKERS.filter(
    (t) => t.includes(q) && !t.startsWith(q)
  ).slice(0, 10 - exactMatches.length);

  const results = [...exactMatches, ...partialMatches];
  return results.length > 0 ? results : DEFAULT;
}
