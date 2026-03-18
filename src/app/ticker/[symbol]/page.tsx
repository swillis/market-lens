"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, AlertTriangle } from "lucide-react";
import { PriceCard } from "@/components/price-card";
import { ExplanationCard } from "@/components/explanation-card";
import { DriversCard } from "@/components/drivers-card";
import { NewsList } from "@/components/news-list";
import { TimelineCard } from "@/components/timeline-card";
import { ChartCard } from "@/components/chart/chart-card";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ErrorState } from "@/components/error-state";
import { TickerSearch } from "@/components/ticker-search";
import { formatTimestamp } from "@/lib/utils/dates";
import type { TickerResult, ApiErrorResponse } from "@/lib/types/market";
import type { NarrativeSnapshot } from "@/lib/types/analysis";
import type { IntradayData } from "@/lib/services/intraday";

type SlimSnapshot = Omit<NarrativeSnapshot, "articles">;

export default function TickerPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = (params.symbol as string)?.toUpperCase();

  const [result, setResult]       = useState<TickerResult | null>(null);
  const [error, setError]         = useState<ApiErrorResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [snapshots, setSnapshots] = useState<SlimSnapshot[]>([]);
  const [intraday, setIntraday]   = useState<IntradayData | null>(null);

  // Main analysis fetch
  useEffect(() => {
    if (!symbol) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSnapshots([]);
    setIntraday(null);

    fetch(`/api/explain?symbol=${encodeURIComponent(symbol)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw data;
        return data;
      })
      .then((data: TickerResult) => setResult(data))
      .catch((err) => {
        setError(
          err && typeof err === "object" && "code" in err
            ? (err as ApiErrorResponse)
            : { error: err?.message || "Failed to fetch data", code: "UPSTREAM_ERROR", retryable: true }
        );
      })
      .finally(() => setLoading(false));
  }, [symbol]);

  // Timeline + intraday fetches — run after the main result lands
  useEffect(() => {
    if (!result || !symbol) return;

    fetch(`/api/timeline/${encodeURIComponent(symbol)}`)
      .then((res) => res.json())
      .then((data: SlimSnapshot[]) => setSnapshots(data))
      .catch(() => {/* non-fatal — timeline is supplementary */});

    fetch(`/api/intraday/${encodeURIComponent(symbol)}`)
      .then((res) => res.json())
      .then((data: IntradayData) => setIntraday(data))
      .catch(() => {/* non-fatal — chart is supplementary */});
  }, [result, symbol]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Home
        </Link>
        <div className="w-64">
          <TickerSearch />
        </div>
      </div>

      {loading && <LoadingSkeleton />}

      {error && (
        <ErrorState
          title={`Couldn't analyze ${symbol}`}
          message={error.error}
          retryable={error.retryable}
        />
      )}

      {result && (() => {
        const topArticleIndices = [
          ...new Set(
            result.explanation.drivers.flatMap((d) => d.evidenceArticleIndices)
          ),
        ];

        return (
          <div className="space-y-6">
            <PriceCard price={result.price} company={result.company} />

            {intraday && intraday.points.length >= 2 && (
              <ChartCard data={intraday.points} isPositive={intraday.isPositive} />
            )}

            {result.warnings && result.warnings.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="text-sm text-amber-400">
                  {result.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              </div>
            )}

            <ExplanationCard explanation={result.explanation} />

            {/* Timeline sits beneath the main analysis card */}
            {snapshots.length > 0 && <TimelineCard snapshots={snapshots} />}

            <DriversCard
              drivers={result.explanation.drivers}
              news={result.news}
            />
            <NewsList
              articles={result.news}
              topArticleIndices={topArticleIndices}
            />

            <div className="flex items-center justify-center gap-2 pb-8 text-xs text-zinc-600">
              <Clock className="h-3 w-3" />
              <span>Analysis generated {formatTimestamp(result.generatedAt)}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
