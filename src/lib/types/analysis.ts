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
 * Carries evidence references so confidence can be computed deterministically.
 */
export type CandidateDriver = {
  title: string;
  explanation: string;
  supportingArticles: ScoredArticle[];
  evidenceArticleIndices: number[];
  driverType: "company" | "sector" | "macro" | "unclear";
  rawScore: number; // 0–1 strength of evidence
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
