import type { StockExplanation } from "@/lib/types/market";
import { cn } from "@/lib/utils/cn";
import { Sparkles } from "lucide-react";

const confidenceColors = {
  low: "bg-amber-50 text-amber-700 border-amber-200",
  medium: "bg-zinc-100 text-zinc-600 border-zinc-200",
  high: "bg-green-50 text-green-700 border-green-200",
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
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-zinc-400" />
        <h2 className="text-lg font-semibold text-zinc-900">AI Analysis</h2>
        <div className="flex-1" />
        <span
          className={cn(
            "rounded-full border px-3 py-0.5 text-xs font-medium",
            confidenceColors[explanation.confidence]
          )}
        >
          {explanation.confidence} confidence
        </span>
        <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-0.5 text-xs text-zinc-500">
          {reasoningLabels[explanation.reasoningType] || explanation.reasoningType}
        </span>
      </div>

      <p className="text-base leading-relaxed text-zinc-700">
        {explanation.summary}
      </p>

      {explanation.caveats.length > 0 && (
        <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
            Caveats
          </p>
          <ul className="space-y-1">
            {explanation.caveats.map((caveat, i) => (
              <li key={i} className="text-sm text-zinc-500">
                {caveat}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
