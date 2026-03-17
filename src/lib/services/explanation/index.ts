import type { AnalysisInput, ExplanationResult } from "@/lib/types/analysis";
import { scoreArticles } from "./article-scoring";
import { consolidateDrivers } from "./driver-consolidation";
import { calculateConfidence } from "./confidence";
import { synthesize } from "./synthesis";
import { buildSnapshot, storeSnapshot } from "@/lib/services/snapshot-store";

/**
 * Run the full explanation pipeline sequentially:
 *
 *   1. scoreArticles()        — rank articles by relevance to the price move
 *   2. consolidateDrivers()   — cluster evidence into candidate drivers
 *   3. calculateConfidence()  — compute confidence deterministically from evidence
 *   4. synthesize()           — LLM writes prose only; confidence injected after
 *   5. storeSnapshot()        — persist a NarrativeSnapshot for timeline tracking
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

  // Snapshot — fire-and-forget; never block the response
  try {
    const snapshot = buildSnapshot(
      input.price.symbol,
      result.summary,
      confidenceScore,
      confidenceLabel,
      reasoningType,
      drivers.map((d) => ({
        canonicalKey: d.canonicalKey,
        title: d.title,
        driverType: d.driverType,
        strength: d.strength,
        inferenceLevel: d.inferenceLevel,
        evidenceArticleIndices: d.evidenceArticleIndices,
      })),
      scoredArticles
    );
    storeSnapshot(snapshot);
  } catch (err) {
    console.warn("[pipeline] Snapshot storage failed (non-fatal):", err);
  }

  return result;
}

// Re-export types and individual steps so callers can use them directly
export { scoreArticles } from "./article-scoring";
export { consolidateDrivers } from "./driver-consolidation";
export { calculateConfidence } from "./confidence";
export { synthesize } from "./synthesis";
