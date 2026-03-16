import type { StockExplanation } from "@/lib/types/market";
import { cn } from "@/lib/utils/cn";
import { Sparkles } from "lucide-react";

const confidenceColors = {
  low: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  high: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const reasoningLabels: Record<string, string> = {
  company: "Company-specific",
  sector: "Sector-wide",
  macro: "Macro-driven",
  company_and_sector: "Company + Sector",
  unclear: "Unclear pattern",
};

export function ExplanationCard({
  explanation,
}: {
  explanation: StockExplanation;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-zinc-400" />
        <h2 className="text-lg font-semibold text-white">AI Analysis</h2>
        <div className="flex-1" />
        <span
          className={cn(
            "rounded-full border px-3 py-0.5 text-xs font-medium",
            confidenceColors[explanation.confidence]
          )}
        >
          {explanation.confidence} confidence
        </span>
        <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-0.5 text-xs text-zinc-400">
          {reasoningLabels[explanation.reasoningType] || explanation.reasoningType}
        </span>
      </div>

      <p className="text-base leading-relaxed text-zinc-200">
        {explanation.summary}
      </p>

      {explanation.caveats.length > 0 && (
        <div className="mt-4 rounded-lg bg-zinc-800/50 p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Caveats
          </p>
          <ul className="space-y-1">
            {explanation.caveats.map((caveat, i) => (
              <li key={i} className="text-sm text-zinc-400">
                {caveat}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
