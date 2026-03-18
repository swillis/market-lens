"use client";

import { History, TrendingUp, TrendingDown, Minus, Clock, Moon } from "lucide-react";
import { formatTime, timeAgo } from "@/lib/utils/dates";
import { getMarketStatus } from "@/lib/utils/market-hours";
import type { NarrativeSnapshot } from "@/lib/types/analysis";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConfidenceBadge({ label }: { label: "low" | "medium" | "high" }) {
  const styles = {
    high:   "bg-green-50 text-green-700 ring-1 ring-green-200",
    medium: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200",
    low:    "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[label]}`}>
      {label}
    </span>
  );
}

function DriverChangeBadge({
  title,
  variant,
}: {
  title: string;
  variant: "added" | "removed";
}) {
  const styles =
    variant === "added"
      ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
      : "bg-zinc-100 text-zinc-400 ring-1 ring-zinc-200 line-through";
  const prefix = variant === "added" ? "New: " : "Faded: ";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles}`}>
      {prefix}{title}
    </span>
  );
}

function StrengthIcon({ delta }: { delta?: number }) {
  if (delta === undefined || Math.abs(delta) < 0.05) {
    return <Minus className="h-3 w-3 text-zinc-400" />;
  }
  return delta > 0
    ? <TrendingUp  className="h-3 w-3 text-green-600" />
    : <TrendingDown className="h-3 w-3 text-red-600" />;
}

// ---------------------------------------------------------------------------
// Market status callout — shown when market is not in regular session
// ---------------------------------------------------------------------------

function MarketStatusCallout() {
  const market = getMarketStatus();
  if (market.isRegularSession) return null;

  const isClosedOrWeekend = market.status === "closed";

  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-3">
      {isClosedOrWeekend
        ? <Moon  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
        : <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
      }
      <div className="min-w-0">
        <span className="text-xs font-medium text-zinc-500">{market.label} · </span>
        <span className="text-xs text-zinc-400">{market.description}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline entry
// ---------------------------------------------------------------------------

type SlimSnapshot = Omit<NarrativeSnapshot, "articles">;

function TimelineEntry({
  snapshot,
  isLatest,
  isLast,
}: {
  snapshot: SlimSnapshot;
  isLatest: boolean;
  isLast: boolean;
}) {
  const mainText = snapshot.changeNarrative ?? snapshot.summary;
  const topDrivers = snapshot.drivers.slice(0, 2);

  return (
    <div className="flex gap-4">
      {/* Left: dot + connector line */}
      <div className="flex flex-col items-center">
        <div
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ${
            isLatest
              ? "bg-zinc-900 ring-zinc-900/20"
              : "bg-zinc-300 ring-zinc-300/30"
          }`}
        />
        {!isLast && <div className="mt-1 w-px flex-1 bg-zinc-200" />}
      </div>

      {/* Right: content */}
      <div className="min-w-0 flex-1 pb-6">
        {/* Time + badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500">
            {formatTime(snapshot.timestamp)}
          </span>
          <span className="text-xs text-zinc-400">{timeAgo(snapshot.timestamp)}</span>
          <ConfidenceBadge label={snapshot.confidenceLabel} />
        </div>

        {/* Change narrative or initial summary */}
        <p className={`mt-1.5 text-sm leading-relaxed ${isLatest ? "text-zinc-700" : "text-zinc-500"}`}>
          {mainText}
        </p>

        {/* Driver change badges */}
        {((snapshot.addedDriverChanges?.length ?? 0) > 0 ||
          (snapshot.removedDriverChanges?.length ?? 0) > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {snapshot.addedDriverChanges?.map((d) => (
              <DriverChangeBadge key={d.canonicalKey} title={d.title} variant="added" />
            ))}
            {snapshot.removedDriverChanges?.map((d) => (
              <DriverChangeBadge key={d.canonicalKey} title={d.title} variant="removed" />
            ))}
          </div>
        )}

        {/* Top 1–2 drivers */}
        {topDrivers.length > 0 && (
          <div className="mt-2.5 flex flex-col gap-1">
            {topDrivers.map((d) => (
              <div key={d.canonicalKey} className="flex items-center gap-2">
                <StrengthIcon />
                <span className="text-xs text-zinc-500">{d.title}</span>
                <span className="ml-auto text-[11px] text-zinc-400">
                  {Math.round(d.strength * 100)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

export function TimelineCard({ snapshots }: { snapshots: SlimSnapshot[] }) {
  if (snapshots.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-5 flex items-center gap-2">
        <History className="h-5 w-5 text-zinc-400" />
        <h2 className="text-lg font-semibold text-zinc-900">Narrative Timeline</h2>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
          {snapshots.length}
        </span>
      </div>

      <MarketStatusCallout />

      <div>
        {snapshots.map((snapshot, i) => (
          <TimelineEntry
            key={snapshot.id}
            snapshot={snapshot}
            isLatest={i === 0}
            isLast={i === snapshots.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
