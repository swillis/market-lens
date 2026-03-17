"use client";

import type { StockExplanation, NewsArticle } from "@/lib/types/market";
import { ListOrdered, ExternalLink } from "lucide-react";

function ArticleRow({ article }: { article: NewsArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition hover:bg-zinc-700/40"
    >
      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600 group-hover:bg-zinc-400" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-xs text-zinc-400 group-hover:text-zinc-200">
          {article.title}
        </span>
        <span className="mt-0.5 block text-[11px] text-zinc-600">
          {article.source}
        </span>
      </span>
      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-zinc-700 group-hover:text-zinc-500" />
    </a>
  );
}

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

      <div className="space-y-3">
        {drivers.map((driver, i) => {
          const supportingArticles = driver.evidenceArticleIndices
            .map((idx) => news[idx])
            .filter(Boolean) as NewsArticle[];

          return (
            <div
              key={i}
              className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-300">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-white">{driver.title}</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    {driver.explanation}
                  </p>

                  {supportingArticles.length > 0 && (
                    <div className="mt-3 border-t border-zinc-700/50 pt-2">
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                        Supported by
                      </p>
                      <div className="space-y-0.5">
                        {supportingArticles.map((article, j) => (
                          <ArticleRow key={j} article={article} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
