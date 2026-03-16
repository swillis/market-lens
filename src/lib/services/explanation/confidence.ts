import type { AnalysisInput, ScoredArticle, CandidateDriver } from "@/lib/types/analysis";

/**
 * Deterministically calculate confidence based on available evidence.
 *
 * This is a key architectural improvement over the previous design where
 * confidence was self-reported by the LLM (unreliable, inconsistent).
 * By computing it here, the synthesis step receives it as a constraint
 * rather than a suggestion, making the pipeline auditable and testable.
 *
 * Current rules (v1 — heuristic):
 *  - "high":   3+ relevant articles OR 2+ pre-computed drivers
 *  - "medium": 1–2 relevant articles OR 1 pre-computed driver
 *  - "low":    no articles or only weak evidence (relevanceScore ≤ 0.3)
 *
 * Future rules will also factor in:
 *  - Peer correlation (did sector move with the stock?)
 *  - Magnitude of the price move relative to recent volatility
 *  - Article recency (same-day news vs. older articles)
 *  - Source authority scores
 */
export function calculateConfidence(
  scoredArticles: ScoredArticle[],
  drivers: CandidateDriver[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  input: AnalysisInput
): "low" | "medium" | "high" {
  // Direct evidence: company-specific articles with high relevance
  const directEvidence = scoredArticles.filter(
    (a) => a.usefulness === "direct_evidence" || (a.relevance >= 4 && a.relationType === "company")
  );

  // Supporting context: sector/macro articles or moderate-relevance company articles
  const supportingContext = scoredArticles.filter(
    (a) => a.usefulness === "supporting_context" || (a.relevance >= 2 && a.relationType !== "unrelated")
  );

  // Pre-computed drivers (from consolidation step — currently always 0)
  if (drivers.length >= 2 || directEvidence.length >= 2) return "high";
  if (drivers.length >= 1 || directEvidence.length >= 1) return "medium";
  if (supportingContext.length >= 2) return "medium";
  if (supportingContext.length >= 1) return "low";
  return "low";
}
