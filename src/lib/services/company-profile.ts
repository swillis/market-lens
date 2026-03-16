import type { CompanyProfile } from "@/lib/types/market";
import { getMockCompany } from "./mock-data";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { fmpProfileArraySchema } from "@/lib/schemas/api-responses";
import {
  tickerNotFound,
  apiTimeout,
  apiRateLimited,
  apiUnavailable,
  validationFailed,
} from "@/lib/errors";

const FMP_BASE = "https://financialmodelingprep.com/stable";

export async function fetchCompanyProfile(
  symbol: string
): Promise<CompanyProfile> {
  if (process.env.USE_MOCK_DATA === "true" || !process.env.FMP_API_KEY) {
    const mock = getMockCompany(symbol);
    if (!mock) throw tickerNotFound(symbol);
    return mock;
  }

  let res: Response;
  try {
    const url = `${FMP_BASE}/profile?symbol=${encodeURIComponent(symbol)}&apikey=${process.env.FMP_API_KEY}`;
    res = await fetchWithTimeout(url, { timeout: 5000, next: { revalidate: 3600 } } as RequestInit & { timeout?: number });
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
  const parsed = fmpProfileArraySchema.safeParse(data);

  if (!parsed.success) {
    if (Array.isArray(data) && data.length === 0) {
      throw tickerNotFound(symbol);
    }
    throw validationFailed("FMP", parsed.error.message);
  }

  const profile = parsed.data[0];
  return {
    symbol: profile.symbol,
    companyName: profile.companyName,
    sector: profile.sector || undefined,
    industry: profile.industry || undefined,
    exchange: profile.exchange || undefined,
  };
}
