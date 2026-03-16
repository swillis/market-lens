import { NextResponse } from "next/server";
import { fetchPriceSnapshot } from "@/lib/services/market-data";
import { fetchCompanyProfile } from "@/lib/services/company-profile";
import { fetchNews } from "@/lib/services/news";
import { fetchPeerContext } from "@/lib/services/peers";
import { generateExplanation } from "@/lib/services/explain";
import { MarketLensError } from "@/lib/errors";
import type { TickerResult } from "@/lib/types/market";

// In-memory sliding window rate limiter
const RATE_LIMIT = { windowMs: 60_000, maxRequests: 10 };
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT.windowMs);
  if (recent.length >= RATE_LIMIT.maxRequests) return true;
  recent.push(now);
  requestLog.set(ip, recent);
  return false;
}

export async function GET(request: Request) {
  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute.", code: "API_RATE_LIMITED", retryable: true },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase().trim();

  if (!symbol || !/^[A-Z]{1,5}$/.test(symbol)) {
    return NextResponse.json(
      { error: "Invalid ticker symbol. Please provide 1-5 uppercase letters.", code: "INVALID_TICKER", retryable: false },
      { status: 400 }
    );
  }

  try {
    // Price and company are required
    const [price, company] = await Promise.all([
      fetchPriceSnapshot(symbol),
      fetchCompanyProfile(symbol),
    ]);

    // News and peers are optional — degrade gracefully
    const [newsResult, peersResult] = await Promise.allSettled([
      fetchNews(symbol),
      fetchPeerContext(symbol),
    ]);

    const news = newsResult.status === "fulfilled" ? newsResult.value : [];
    const peers = peersResult.status === "fulfilled" ? peersResult.value : { peers: [] };

    const warnings: string[] = [];
    if (newsResult.status === "rejected") {
      console.warn(`News fetch rejected for ${symbol}:`, newsResult.reason);
      warnings.push("News data is temporarily unavailable.");
    }
    if (peersResult.status === "rejected") {
      console.warn(`Peers fetch rejected for ${symbol}:`, peersResult.reason);
      warnings.push("Peer comparison data is temporarily unavailable.");
    }

    // Generate AI explanation
    const explanation = await generateExplanation(price, company, news, peers);

    const result: TickerResult = {
      price,
      company,
      news,
      peers,
      explanation,
      generatedAt: new Date().toISOString(),
      ...(warnings.length > 0 ? { warnings } : {}),
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MarketLensError) {
      return NextResponse.json(
        { error: error.message, code: error.code, retryable: error.retryable },
        { status: error.statusCode }
      );
    }

    console.error(`Unexpected error for ${symbol}:`, error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again.", code: "UPSTREAM_ERROR", retryable: true },
      { status: 500 }
    );
  }
}
