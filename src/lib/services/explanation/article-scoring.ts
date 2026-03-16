import type { AnalysisInput, ScoredArticle } from "@/lib/types/analysis";

/**
 * Score each article for relevance to the observed price move.
 *
 * Current implementation: structural stub that passes all articles through
 * with a neutral score of 0.5, preserving pipeline shape without changing
 * downstream behaviour.
 *
 * Future implementation will apply:
 *  - Keyword matching against company name / symbol / sector
 *  - Recency decay (articles closer to the price move score higher)
 *  - Source authority weighting (earnings releases > blog posts)
 *  - Peer / sector signal detection (e.g. competitor earnings as indirect catalyst)
 */
export function scoreArticles(input: AnalysisInput): ScoredArticle[] {
  return input.articles.map((article) => ({
    ...article,
    // Neutral default — deterministic scoring logic to be added in next iteration
    relevanceScore: 0.5,
    relevanceReason: undefined,
  }));
}
