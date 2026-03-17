import type { AnalysisInput, ExplanationResult } from "@/lib/types/analysis";
import { scoreArticles } from "./article-scoring";
import { consolidateDrivers } from "./driver-consolidation";
import { calculateConfidence } from "./confidence";
import { synthesize } from "./synthesis";
import { buildSnapshot, storeSnapshot, getSnapshots } from "@/lib/services/snapshot-store";
import { compareSnapshots, generateNarrativeSummary } from "@/lib/services/snapshot-comparison";

/**
 * Run the full explanation pipeline sequentially:
 *
 *   1. scoreArticles()        — rank articles by relevance to the price move
 *   2. consolidateDrivers()   — cluster evidence into candidate drivers
 *   3. calculateConfidence()  — compute confidence deterministically from evidence
 *   4. synthesize()           — LLM writes prose only; confidence injected after
 *   5. maybeStoreSnapshot()   — persist only when meaningful narrative changes occur
 *
 * Each step is independently testable and replaceable.
 */
export async function runExplanationPipeline(
  input: AnalysisInput
): Promise<ExplanationResult> {
  const scoredArticles = await scoreArticles(input);
  const { drivers, reasoningType } = await consolidateDrivers(scoredArticles, input);
  const { confidenceScore, confidenceLabel } = calculateConfidence(scoredArticles, drivers, input);
  const result = await synthesize(input, scoredArticles, drivers, confidenceLabel, reasoningType);

  // Snapshot — fire-and-forget async block; never blocks the API response
  (async () => {
    try {
      const symbol = input.price.symbol;
      const driverRecords = drivers.map((d) => ({
        canonicalKey: d.canonicalKey,
        title: d.title,
        driverType: d.driverType,
        strength: d.strength,
        inferenceLevel: d.inferenceLevel,
        evidenceArticleIndices: d.evidenceArticleIndices,
      }));

      const [previousSnapshot] = getSnapshots(symbol);

      if (!previousSnapshot) {
        // First snapshot for this symbol — store unconditionally
        storeSnapshot(buildSnapshot(
          symbol, result.summary, confidenceScore, confidenceLabel,
          reasoningType, driverRecords, scoredArticles
        ));
        return;
      }

      // Build a candidate snapshot to diff against the previous one
      const candidate = buildSnapshot(
        symbol, result.summary, confidenceScore, confidenceLabel,
        reasoningType, driverRecords, scoredArticles
      );

      const diff = compareSnapshots(previousSnapshot, candidate);

      if (!diff.hasChanges) {
        // Nothing meaningful changed — skip storage to keep the timeline clean
        return;
      }

      // Something changed — generate narrative and store the enriched snapshot
      const changeNarrative = await generateNarrativeSummary(diff);

      storeSnapshot(buildSnapshot(
        symbol, result.summary, confidenceScore, confidenceLabel,
        reasoningType, driverRecords, scoredArticles,
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
      ));
    } catch (err) {
      console.warn("[pipeline] Snapshot storage failed (non-fatal):", err);
    }
  })();

  return result;
}

// Re-export types and individual steps so callers can use them directly
export { scoreArticles } from "./article-scoring";
export { consolidateDrivers } from "./driver-consolidation";
export { calculateConfidence } from "./confidence";
export { synthesize } from "./synthesis";
