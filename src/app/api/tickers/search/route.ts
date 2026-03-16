import { searchTickers } from "@/lib/services/ticker-search";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  try {
    const results = await searchTickers(query);
    return Response.json({ results });
  } catch (error) {
    console.error("Ticker search error:", error);
    return Response.json(
      { error: "Failed to search tickers" },
      { status: 500 }
    );
  }
}
