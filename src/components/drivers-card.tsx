import type { StockExplanation, NewsArticle } from "@/lib/types/market";
import { ListOrdered } from "lucide-react";

export function DriversCard({
  drivers,
  news,
}: {
  drivers: StockExplanation["drivers"];
  news: NewsArticle[];
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-4 flex items-center gap-2">
        <ListOrdered className="h-5 w-5 text-zinc-400" />
        <h2 className="text-lg font-semibold text-white">Likely Drivers</h2>
      </div>

      <div className="space-y-4">
        {drivers.map((driver, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-300">
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="font-medium text-white">{driver.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {driver.explanation}
                </p>
                {driver.evidenceArticleIndices.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {driver.evidenceArticleIndices.map((idx) => {
                      const article = news[idx];
                      if (!article) return null;
                      return (
                        <span
                          key={idx}
                          className="rounded bg-zinc-700/50 px-2 py-0.5 text-xs text-zinc-400"
                        >
                          {article.source}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
