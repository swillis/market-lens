import type { AnalysisInput, ScoredArticle, CandidateDriver } from "@/lib/types/analysis";

/**
 * Consolidate scored articles into a ranked list of candidate drivers.
 *
 * Current implementation: structural stub that returns an empty list,
 * deferring all driver identification to the synthesis (LLM) step.
 * This preserves existing behaviour while establishing the interface.
 *
 * Future implementation will:
 *  - Cluster articles by topic using keyword / embedding similarity
 *  - Identify whether each cluster is company-specific, sector-wide, or macro
 *  - Assign a rawScore based on cluster size, article relevanceScore, and recency
 *  - Deduplicate overlapping themes across articles
 *  - Produce pre-computed drivers that the synthesis step uses as grounding hints
 *    (reducing the LLM's freedom to invent unsupported causal stories)
 */
export function consolidateDrivers(
  scoredArticles: ScoredArticle[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  input: AnalysisInput
): CandidateDriver[] {
  // Stub: synthesis step handles driver identification via LLM for now
  void scoredArticles;
  return [];
}
