import type { StoryItem } from "@/lib/services/homepage";

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type Props = {
  stories: StoryItem[];
};

export function MarketStoriesSection({ stories }: Props) {
  if (stories.length === 0) return null;

  return (
    <div>
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-zinc-900">Market stories</span>
        <span className="text-[12px] text-zinc-400">News moving stocks now</span>
      </div>

      {/* Stacked list */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 flex flex-col gap-px">
        {stories.map((story, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-3 bg-white px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-[13px] leading-snug text-zinc-900">
                {story.headline}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {story.relatedTickers.map(({ symbol, changePercent }) => {
                  const isPositive = changePercent >= 0;
                  return (
                    <span
                      key={symbol}
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        isPositive
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {symbol} {isPositive ? "+" : ""}
                      {changePercent.toFixed(1)}%
                    </span>
                  );
                })}
              </div>
            </div>
            <span className="shrink-0 text-[11px] text-zinc-400">
              {timeAgo(story.publishedAt)}
            </span>
          </div>
        ))}

        {/* Footer */}
        <div className="bg-zinc-50 py-2.5 text-center">
          <span className="text-[12px] text-zinc-400">Show more stories</span>
        </div>
      </div>
    </div>
  );
}
