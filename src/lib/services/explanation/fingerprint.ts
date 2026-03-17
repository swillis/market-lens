/**
 * Deterministic source fingerprinting for the explanation pipeline.
 *
 * A fingerprint captures whether the meaningful inputs to the pipeline have
 * changed since the last run. Identical fingerprints guarantee that re-running
 * the pipeline would produce the same analysis — so we can safely skip it.
 *
 * What IS included (high-signal, stable):
 *   - symbol (always relevant)
 *   - price-change bucket (rounded to 0.5% bands — ignores tick noise)
 *   - sorted article URLs / titles + publish timestamps (top 10)
 *
 * What is NOT included (noisy, would cause false cache misses):
 *   - exact price ($182.34 vs $182.35)
 *   - request timestamp
 *   - peer percentage moves (changes constantly)
 */

import type { AnalysisInput } from "@/lib/types/analysis";
import type { NarrativeSnapshot } from "@/lib/types/analysis";

// ---------------------------------------------------------------------------
// Hash function — djb2 variant, 32-bit, stable across JS runtimes
// ---------------------------------------------------------------------------

function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (((hash << 5) + hash) ^ str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// Price bucketing — round % to nearest 0.5 band
// ---------------------------------------------------------------------------

function priceBucket(changePercent: number): string {
  const rounded = Math.round(changePercent * 2) / 2;
  return (rounded >= 0 ? "+" : "") + rounded.toFixed(1);
}

// ---------------------------------------------------------------------------
// Article fingerprint — top 10 sorted by publish date, stable order
// ---------------------------------------------------------------------------

function articleFingerprint(input: AnalysisInput): string {
  return input.articles
    .slice(0, 10)
    .map((a) => `${a.url || a.title}@${a.publishedAt}`)
    .sort()
    .join("|");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a stable fingerprint string from the key inputs used for explanation
 * generation. Two requests with the same fingerprint would produce the same
 * pipeline output — meaning we can safely return the cached explanation.
 */
export function computeFingerprint(input: AnalysisInput): string {
  const parts = [
    input.price.symbol,
    priceBucket(input.price.changePercent),
    articleFingerprint(input),
  ];
  return djb2(parts.join(":"));
}

// ---------------------------------------------------------------------------
// Snapshot generation gate
// ---------------------------------------------------------------------------

export type ShouldGenerateResult = {
  shouldGenerate: boolean;
  reason:
    | "no_previous_snapshot"
    | "fingerprint_match"         // inputs unchanged — skip
    | "inputs_changed";           // fingerprint differs — regenerate
};

/**
 * Decide whether to run the full pipeline and store a new snapshot.
 *
 * Rules:
 *  1. No previous snapshot → generate (first run for this symbol)
 *  2. Fingerprint matches previous snapshot → skip (inputs unchanged)
 *  3. Fingerprint changed → generate (new articles or meaningful price shift)
 *
 * Note: TTL alone does not force regeneration. If inputs haven't changed,
 * the existing snapshot is still correct — re-running would produce the same
 * result at unnecessary cost.
 */
export function shouldGenerateNewSnapshot({
  latestSnapshot,
  currentFingerprint,
}: {
  latestSnapshot: NarrativeSnapshot | null;
  currentFingerprint: string;
}): ShouldGenerateResult {
  if (!latestSnapshot) {
    return { shouldGenerate: true, reason: "no_previous_snapshot" };
  }

  if (latestSnapshot.sourceFingerprint === currentFingerprint) {
    return { shouldGenerate: false, reason: "fingerprint_match" };
  }

  return { shouldGenerate: true, reason: "inputs_changed" };
}
