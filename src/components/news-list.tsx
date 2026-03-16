import type { NewsArticle } from "@/lib/types/market";
import { timeAgo } from "@/lib/utils/dates";
import { Newspaper, ExternalLink } from "lucide-react";

export function NewsList({ articles }: { articles: NewsArticle[] }) {
  if (articles.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-white">Recent News</h2>
        </div>
        <p className="mt-4 text-sm text-zinc-500">
          No recent news articles found for this ticker.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Newspaper className="h-5 w-5 text-zinc-400" />
        <h2 className="text-lg font-semibold text-white">Supporting Evidence</h2>
      </div>

      <div className="space-y-3">
        {articles.map((article, i) => (
          <a
            key={i}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-lg border border-zinc-800 bg-zinc-800/30 p-4 transition hover:border-zinc-600"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-medium text-zinc-200 group-hover:text-white">
                  {article.title}
                </h3>
                {article.summary && (
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                    {article.summary}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                  <span>{article.source}</span>
                  <span>&middot;</span>
                  <span>{timeAgo(article.publishedAt)}</span>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-zinc-600 group-hover:text-zinc-400" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
