"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, AlertTriangle } from "lucide-react";
import { PriceCard } from "@/components/price-card";
import { ExplanationCard } from "@/components/explanation-card";
import { DriversCard } from "@/components/drivers-card";
import { NewsList } from "@/components/news-list";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ErrorState } from "@/components/error-state";
import { TickerSearch } from "@/components/ticker-search";
import { formatTimestamp } from "@/lib/utils/dates";
import type { TickerResult, ApiErrorResponse } from "@/lib/types/market";

export default function TickerPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = (params.symbol as string)?.toUpperCase();
  const [result, setResult] = useState<TickerResult | null>(null);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;

    setLoading(true);
    setError(null);
    setResult(null);

    fetch(`/api/explain?symbol=${encodeURIComponent(symbol)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw data;
        }
        return data;
      })
      .then((data: TickerResult) => setResult(data))
      .catch((err) => {
        if (err && typeof err === "object" && "code" in err) {
          setError(err as ApiErrorResponse);
        } else {
          setError({
            error: err?.message || "Failed to fetch data",
            code: "UPSTREAM_ERROR",
            retryable: true,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [symbol]);

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
        // Collect unique article indices referenced by drivers, preserving order
        const topArticleIndices = [
          ...new Set(
            result.explanation.drivers.flatMap((d) => d.evidenceArticleIndices)
          ),
        ];

        return (
        <div className="space-y-6">
          <PriceCard price={result.price} company={result.company} />

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
            <span>
              Analysis generated {formatTimestamp(result.generatedAt)}
            </span>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
