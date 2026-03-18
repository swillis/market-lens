import { NextResponse } from "next/server";
import { fetchHomepageData } from "@/lib/services/homepage";

export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    const data = await fetchHomepageData();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/homepage] Unexpected error:", err);
    return NextResponse.json(
      { movers: null, signals: [], watchlist: null },
      { status: 200 } // still 200 — UI degrades gracefully
    );
  }
}
