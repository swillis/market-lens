/**
 * Explanation pipeline orchestrator.
 *
 * Request flow:
 *
 *   1. computeFingerprint()         — hash symbol + price bucket + articles
 *   2. getLatestExplanation()       — check in-memory cache (fingerprint + TTL)
 *      └─ CACHE HIT  → return immediately, 0 LLM calls
 *      └─ CACHE MISS → continue
 *   3. scoreArticles()              — LLM call #1: relevance judge
 *   4. consolidateDrivers()         — DETERMINISTIC: group by candidateDriver label
 *   5. calculateConfidence()        — DETERMINISTIC: weighted score → label
 *   6. synthesize()                 — LLM call #2: writer only
 *   7. setLatestExplanation()       — cache the result
 *   8. maybeStoreSnapshot()         — fire-and-forget, deterministic diff,
 *                                     stores only when hasChanges is true
 *
 * LLM calls per request:
 *   cache hit  → 0
 *   cache miss → 2 (scoreArticles + synthesize)
 */

import type { AnalysisInput, ExplanationResult } from "@/lib/types/analysis";
import { scoreArticles } from "./article-scoring";
import { consolidateDrivers } from "./driver-consolidation";
import { calculateConfidence } from "./confidence";
import { synthesize } from "./synthesis";
import { computeFingerprint, shouldGenerateNewSnapshot } from "./fingerprint";
import {
  getLatestExplanation,
  setLatestExplanation,
} from "@/lib/services/cache/explanation-cache";
import {
  buildSnapshot,
  storeSnapshot,
  getSnapshots,
} from "@/lib/services/snapshot-store";
import { compareSnapshots, generateNarrativeSummary } from "@/lib/services/snapshot-comparison";

// ---------------------------------------------------------------------------
// Logging (dev only)
// ---------------------------------------------------------------------------

const IS_DEV = process.env.NODE_ENV === "development";

function log(msg: string): void {
  if (IS_DEV) console.log(`[pipeline] ${msg}`);
}

// ---------------------------------------------------------------------------
// Snapshot helper — fire-and-forget, never blocks the response
// ---------------------------------------------------------------------------

function maybeStoreSnapshot(
  input: AnalysisInput,
  result: ExplanationResult,
  fingerprint: string,
  confidenceScore: number,
  confidenceLabel: "low" | "medium" | "high",
  reasoningType: ExplanationResult["reasoningType"],
  scoredArticles: Parameters<typeof buildSnapshot>[6],
  drivers: Parameters<typeof buildSnapshot>[5]
): void {
  // Intentionally not awaited
  void (async () => {
    try {
      const symbol = input.price.symbol;
      const [latestSnapshot] = await getSnapshots(symbol);

      const { shouldGenerate, reason } = shouldGenerateNewSnapshot({
        latestSnapshot: latestSnapshot ?? null,
        currentFingerprint: fingerprint,
      });

      if (!shouldGenerate) {
        log(`Snapshot skipped for ${symbol} (${reason})`);
        return;
      }

      // Build candidate snapshot
      const candidate = buildSnapshot(
        symbol,
        result.summary,
        confidenceScore,
        confidenceLabel,
        reasoningType,
        drivers,
        scoredArticles,
        fingerprint
      );

      if (!latestSnapshot) {
        // First snapshot — store unconditionally
        await storeSnapshot(candidate);
        log(`Snapshot stored for ${symbol} (first snapshot)`);
        return;
      }

      // Diff against latest — deterministic, no LLM
      const diff = compareSnapshots(latestSnapshot, candidate);

      if (!diff.hasChanges) {
        log(`Snapshot skipped for ${symbol} (no meaningful diff)`);
        return;
      }

      const changeNarrative = generateNarrativeSummary(diff); // sync, no LLM

      await storeSnapshot(
        buildSnapshot(
          symbol,
          result.summary,
          confidenceScore,
          confidenceLabel,
          reasoningType,
          drivers,
          scoredArticles,
          fingerprint,
          {
            changeNarrative,
            addedDriverChanges: diff.addedDrivers.map((d) => ({
              canonicalKey: d.canonicalKey,
              title: d.title,
              driverType: d.driverType,
            })),
            removedDriverChanges: diff.removedDrivers.map((d) => ({
              canonicalKey: d.canonicalKey,
              title: d.title,
              driverType: d.driverType,
            })),
          }
        )
      );

      log(
        `Snapshot stored for ${symbol} (${
          diff.addedDrivers.length > 0 ? `+${diff.addedDrivers.length} drivers` :
          diff.removedDrivers.length > 0 ? `-${diff.removedDrivers.length} drivers` :
          diff.reasoningTypeChanged ? "reasoning type shift" :
          "confidence change"
        })`
      );
    } catch (err) {
      // Snapshot storage is best-effort — never surfaces to the user
      console.warn("[pipeline] Snapshot storage failed (non-fatal):", err);
    }
  })();
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function runExplanationPipeline(
  input: AnalysisInput
): Promise<ExplanationResult> {
  const symbol = input.price.symbol;

  // ── Step 1: Fingerprint ──────────────────────────────────────────────────
  const fingerprint = computeFingerprint(input);

  // ── Step 2: Cache check ──────────────────────────────────────────────────
  const cached = getLatestExplanation(symbol, fingerprint);
  if (cached) {
    log(`CACHE HIT  ${symbol} fp=${fingerprint} — 0 LLM calls`);
    return cached;
  }

  log(`CACHE MISS ${symbol} fp=${fingerprint} — running pipeline`);

  // ── Step 3: Score articles (LLM #1) ─────────────────────────────────────
  const scoredArticles = await scoreArticles(input);

  // ── Step 4: Consolidate drivers (deterministic) ──────────────────────────
  const { drivers, reasoningType } = consolidateDrivers(scoredArticles, input);

  // ── Step 5: Confidence (deterministic) ───────────────────────────────────
  const { confidenceScore, confidenceLabel } = calculateConfidence(
    scoredArticles,
    drivers,
    input
  );

  // ── Step 6: Synthesize (LLM #2) ──────────────────────────────────────────
  const result = await synthesize(
    input,
    scoredArticles,
    drivers,
    confidenceLabel,
    reasoningType
  );

  log(`Pipeline complete for ${symbol} — 2 LLM calls (score + synthesize)`);

  // ── Step 7: Cache result ─────────────────────────────────────────────────
  setLatestExplanation(symbol, result, fingerprint);

  // ── Step 8: Snapshot (fire-and-forget) ───────────────────────────────────
  const driverRecords = drivers.map((d) => ({
    canonicalKey: d.canonicalKey,
    title: d.title,
    driverType: d.driverType,
    strength: d.strength,
    inferenceLevel: d.inferenceLevel,
    evidenceArticleIndices: d.evidenceArticleIndices,
  }));

  maybeStoreSnapshot(
    input,
    result,
    fingerprint,
    confidenceScore,
    confidenceLabel,
    reasoningType,
    scoredArticles,
    driverRecords
  );

  return result;
}

// Re-export individual steps for direct use / testing
export { scoreArticles } from "./article-scoring";
export { consolidateDrivers } from "./driver-consolidation";
export { calculateConfidence } from "./confidence";
export { synthesize } from "./synthesis";
