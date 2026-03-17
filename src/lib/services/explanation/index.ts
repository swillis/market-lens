import type { AnalysisInput, ExplanationResult } from "@/lib/types/analysis";
import { scoreArticles } from "./article-scoring";
import { consolidateDrivers } from "./driver-consolidation";
import { calculateConfidence } from "./confidence";
import { synthesize } from "./synthesis";

/**
 * Run the full explanation pipeline sequentially:
 *
 *   1. scoreArticles()        — rank articles by relevance to the price move
 *   2. consolidateDrivers()   — cluster evidence into candidate drivers
 *   3. calculateConfidence()  — compute confidence deterministically from evidence
 *   4. synthesize()           — call LLM with pre-processed, grounded context
 *
 * Each step is independently testable and replaceable. The pipeline can be
 * extended with snapshot storage and narrative timeline steps between
 * synthesize() and the caller.
 */
export async function runExplanationPipeline(
  input: AnalysisInput
): Promise<ExplanationResult> {
  const scoredArticles = await scoreArticles(input);
  const { drivers, reasoningType } = await consolidateDrivers(scoredArticles, input);
  const { confidenceLabel } = calculateConfidence(scoredArticles, drivers, input);
  const result = await synthesize(input, scoredArticles, drivers, confidenceLabel, reasoningType);
  return result;
}

// Re-export types and individual steps so callers can use them directly
export { scoreArticles } from "./article-scoring";
export { consolidateDrivers } from "./driver-consolidation";
export { calculateConfidence } from "./confidence";
export { synthesize } from "./synthesis";
