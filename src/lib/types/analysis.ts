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
 * A news article enriched with a relevance score after the scoring step.
 * relevanceScore: 0–1, where 1 = highly relevant to the price move.
 */
export type ScoredArticle = NewsArticle & {
  relevanceScore: number;
  relevanceReason?: string;
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
