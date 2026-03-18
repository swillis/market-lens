import { NextResponse } from "next/server";
import { fetchIntradayData } from "@/lib/services/intraday";
import { fetchPriceSnapshot } from "@/lib/services/market-data";

export const revalidate = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();

  // Fetch price snapshot in parallel with the EOD attempt so the synthetic
  // fallback has open/dayLow/dayHigh available if EOD is unavailable.
  const [priceResult] = await Promise.allSettled([fetchPriceSnapshot(sym)]);
  const price = priceResult.status === "fulfilled" ? priceResult.value : undefined;

  const data = await fetchIntradayData(sym, price);
  return NextResponse.json(data);
}
