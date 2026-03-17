import type {
  PriceSnapshot,
  CompanyProfile,
  NewsArticle,
  PeerContext,
  StockExplanation,
} from "@/lib/types/market";

/**
 * The complete input to the explanation pipeline.
 * Assembled upstream from market-data, company-profile, news, and peers services.
 */
export type AnalysisInput = {
  price: PriceSnapshot;
  company: CompanyProfile;
  articles: NewsArticle[];
  peers: PeerContext;
};

/**
 * A news article enriched with scoring signals from the article-scoring step.
 *
 * relevance:      0–5 integer assigned by the LLM scorer
 * relevanceScore: normalized 0–1 (relevance / 5) for downstream consumers
 * relationType:   how the article relates to the price move
 * usefulness:     how much weight synthesis should give it
 * candidateDriver: short label for the potential driver this article supports
 * rationale:      one-sentence justification from the scorer
 */
export type ScoredArticle = NewsArticle & {
  articleIndex: number;
  relevance: number;           // 0–5 (LLM-assigned)
  relevanceScore: number;      // 0–1 normalized (relevance / 5)
  relationType: "company" | "sector" | "macro" | "unrelated";
  usefulness: "direct_evidence" | "supporting_context" | "irrelevant";
  candidateDriver: string;
  rationale: string;
};

/**
 * A candidate price-move driver identified during consolidation.
 *
 * strength:              0–1, computed deterministically from the relevance
 *                        scores of evidenceArticleIndices (NOT self-reported by LLM).
 * inferenceLevel:        "direct" if company-specific evidence exists, else "supporting".
 * supportingArticles:    resolved references for downstream consumers.
 * evidenceArticleIndices: raw indices into the original article list.
 */
export type CandidateDriver = {
  title: string;
  explanation: string;
  supportingArticles: ScoredArticle[];
  evidenceArticleIndices: number[];
  driverType: "company" | "sector" | "macro";
  strength: number;                          // 0–1 (deterministic)
  inferenceLevel: "direct" | "supporting";
};

/**
 * Return value of consolidateDrivers().
 * Carries both the ranked drivers and the overall reasoning pattern,
 * both of which are passed to synthesis as constraints.
 */
export type ConsolidationResult = {
  drivers: CandidateDriver[];
  reasoningType:
    | "company"
    | "sector"
    | "macro"
    | "company_and_sector"
    | "unclear";
};

/**
 * Return value of calculateConfidence().
 * Both fields are passed to synthesis — the label as a hard constraint,
 * the score for future snapshot storage and trend analysis.
 */
export type ConfidenceResult = {
  confidenceScore: number;                   // 0–1 (deterministic)
  confidenceLabel: "low" | "medium" | "high";
};

/**
 * The final result of the pipeline.
 * Extends StockExplanation with pipeline metadata for observability and future
 * snapshot storage / narrative timeline features.
 */
export type ExplanationResult = StockExplanation & {
  pipelineMetadata: {
    articlesScored: number;
    candidateDriversConsidered: number;
    computedAt: string;
  };
};
