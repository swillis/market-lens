import { NextResponse } from "next/server";
import { getSnapshots } from "@/lib/services/snapshot-store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const snapshots = getSnapshots(symbol.toUpperCase());

  // Strip the full articles array from the response to keep payload small —
  // the timeline UI only needs driver metadata and change descriptions.
  const slim = snapshots.map(({ articles: _articles, ...rest }) => rest);

  return NextResponse.json(slim);
}
