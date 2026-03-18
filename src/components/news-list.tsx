"use client";

import { useState } from "react";
import type { NewsArticle } from "@/lib/types/market";
import { timeAgo } from "@/lib/utils/dates";
import { Newspaper, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

const TOP_COUNT = 3;

function ArticleCard({ article }: { article: NewsArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-zinc-700 group-hover:text-zinc-900">
            {article.title}
          </h3>
          {article.summary && (
            <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
              {article.summary}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
            <span>{article.source}</span>
            <span>&middot;</span>
            <span>{timeAgo(article.publishedAt)}</span>
          </div>
        </div>
        <ExternalLink className="h-4 w-4 shrink-0 text-zinc-300 group-hover:text-zinc-500" />
      </div>
    </a>
  );
}

export function NewsList({
  articles,
  topArticleIndices = [],
}: {
  articles: NewsArticle[];
  topArticleIndices?: number[];
}) {
  const [expanded, setExpanded] = useState(false);

  if (articles.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-900">Top Evidence</h2>
        </div>
        <p className="mt-4 text-sm text-zinc-500">
          No recent news articles found for this ticker.
        </p>
      </div>
    );
  }

  // Surface driver-referenced articles first, then fill with the rest
  const referencedSet = new Set(topArticleIndices);
  const topArticles = [
    ...topArticleIndices.map((i) => articles[i]).filter(Boolean),
    ...articles.filter((_, i) => !referencedSet.has(i)),
  ] as NewsArticle[];

  const visibleArticles = expanded ? topArticles : topArticles.slice(0, TOP_COUNT);
  const hiddenCount = topArticles.length - TOP_COUNT;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Newspaper className="h-5 w-5 text-zinc-400" />
        <h2 className="text-lg font-semibold text-zinc-900">Top Evidence</h2>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
          {articles.length}
        </span>
      </div>

      <div className="space-y-3">
        {visibleArticles.map((article, i) => (
          <ArticleCard key={i} article={article} />
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-2 text-sm text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-700"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Show {hiddenCount} more article{hiddenCount !== 1 ? "s" : ""}
            </>
          )}
        </button>
      )}
    </div>
  );
}
