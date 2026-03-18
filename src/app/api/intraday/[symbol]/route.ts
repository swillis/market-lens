export const runtime = "nodejs";
export const revalidate = 300;

import { NextResponse } from "next/server";
import { fetchIntradayData } from "@/lib/services/intraday";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const data = await fetchIntradayData(symbol.toUpperCase());
  return NextResponse.json(data);
}
