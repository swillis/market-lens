import type { PeerContext } from "@/lib/types/market";
import { getMockPeers } from "./mock-data";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { finnhubPeersSchema, fmpQuoteSchema } from "@/lib/schemas/api-responses";
import { z } from "zod";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const FINNHUB_BASE = "https://finnhub.io/api/v1";

export async function fetchPeerContext(symbol: string): Promise<PeerContext> {
  if (
    process.env.USE_MOCK_DATA === "true" ||
    (!process.env.FMP_API_KEY && !process.env.FINNHUB_API_KEY)
  ) {
    return getMockPeers(symbol);
  }

  try {
    if (!process.env.FINNHUB_API_KEY) return { peers: [] };

    const peersUrl = `${FINNHUB_BASE}/stock/peers?symbol=${encodeURIComponent(symbol)}&token=${process.env.FINNHUB_API_KEY}`;
    // Short timeout so we fail fast and don't block the main response
    const peersRes = await fetchWithTimeout(peersUrl, { timeout: 4000, next: { revalidate: 3600 } } as RequestInit & { timeout?: number });

    if (!peersRes.ok) return { peers: [] };

    const rawPeers = await peersRes.json();
    const parsedPeers = finnhubPeersSchema.safeParse(rawPeers);
    if (!parsedPeers.success) return { peers: [] };

    const filteredPeers = parsedPeers.data
      .filter((s) => s !== symbol)
      .slice(0, 4);

    if (process.env.FMP_API_KEY && filteredPeers.length > 0) {
      const quotesUrl = `${FMP_BASE}/quote?symbol=${filteredPeers.join(",")}&apikey=${process.env.FMP_API_KEY}`;
      const quotesRes = await fetchWithTimeout(quotesUrl, { timeout: 8000, next: { revalidate: 60 } } as RequestInit & { timeout?: number });

      if (quotesRes.ok) {
        const rawQuotes = await quotesRes.json();
        const parsedQuotes = z.array(fmpQuoteSchema).safeParse(rawQuotes);

        if (parsedQuotes.success) {
          return {
            peers: parsedQuotes.data.map((q) => ({
              symbol: q.symbol,
              changePercent: q.changePercentage,
            })),
          };
        }
      }
    }

    return {
      peers: filteredPeers.map((s) => ({ symbol: s })),
    };
  } catch (err) {
    // Silently return empty peers on timeout - this is not a critical feature
    return { peers: [] };
  }
}
