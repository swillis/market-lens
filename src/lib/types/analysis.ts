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
 * canonicalKey:          stable normalized identifier derived from the title,
 *                        used to group the same driver across snapshots over time.
 *                        Example: "Meta AI investment and restructuring" → "meta_ai_investment"
 * strength:              0–1, computed deterministically from the relevance
 *                        scores of evidenceArticleIndices (NOT self-reported by LLM).
 * inferenceLevel:        "direct" if company-specific evidence exists, else "supporting".
 * supportingArticles:    resolved references for downstream consumers.
 * evidenceArticleIndices: raw indices into the original article list.
 */
export type CandidateDriver = {
  title: string;
  canonicalKey: string;
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

/**
 * A driver that exists in both the previous and current snapshot.
 * Carries before/after strength so trend direction is visible without re-diffing.
 */
export type RetainedDriver = {
  canonicalKey: string;
  title: string;               // current title (LLM may rephrase between runs)
  previousTitle: string;       // previous title, for change detection
  driverType: "company" | "sector" | "macro";
  inferenceLevel: "direct" | "supporting";
  previousStrength: number;
  currentStrength: number;
  strengthDelta: number;       // current − previous  (+ve = strengthening, −ve = weakening)
};

/**
 * The structured output of compareSnapshots().
 * All fields are deterministic — no LLM involvement.
 */
export type SnapshotDiff = {
  symbol: string;
  previousSnapshot: NarrativeSnapshot;
  currentSnapshot: NarrativeSnapshot;

  addedDrivers: NarrativeSnapshot["drivers"];    // in current, not in previous
  removedDrivers: NarrativeSnapshot["drivers"];  // in previous, not in current
  retainedDrivers: RetainedDriver[];

  confidenceDelta: number;           // current.confidenceScore − previous.confidenceScore
  reasoningTypeChanged: boolean;

  /**
   * True when there is something worth narrating:
   * any added/removed driver, confidence delta > 0.10, reasoning type shift,
   * or a retained driver whose strength shifted by > 0.10.
   */
  hasChanges: boolean;
};

/**
 * Final output of compareAndNarrate(): the structured diff plus the
 * LLM-written one-to-two sentence change summary.
 * narrativeSummary is null when hasChanges is false.
 */
export type NarrativeComparison = {
  diff: SnapshotDiff;
  narrativeSummary: string | null;
};

/**
 * An immutable point-in-time record of what the pipeline determined about a
 * stock's move. Stored whenever a new explanation is generated.
 *
 * Snapshots form the raw material for the narrative timeline — by comparing
 * canonicalKeys across snapshots we can detect driver persistence, emergence,
 * and resolution over time without re-running the LLM.
 */
export type NarrativeSnapshot = {
  /** Unique identifier: symbol + ISO timestamp */
  id: string;
  symbol: string;
  timestamp: string;           // ISO 8601

  // Explanation fields (frozen at generation time)
  summary: string;
  confidenceScore: number;     // 0–1 deterministic
  confidenceLabel: "low" | "medium" | "high";
  reasoningType:
    | "company"
    | "sector"
    | "macro"
    | "company_and_sector"
    | "unclear";

  /** Compact driver records — canonicalKey enables cross-snapshot grouping */
  drivers: Array<{
    canonicalKey: string;
    title: string;
    driverType: "company" | "sector" | "macro";
    strength: number;
    inferenceLevel: "direct" | "supporting";
    evidenceArticleIndices: number[];
  }>;

  /** The scored articles available at generation time */
  articles: ScoredArticle[];

  /**
   * Deterministic hash of the key inputs used to generate this snapshot
   * (symbol + price-change bucket + sorted article URLs/titles).
   * Identical fingerprint → re-running the pipeline would produce the same
   * result, so the request can be served from cache.
   */
  sourceFingerprint: string;

  /**
   * Change tracking vs the previous snapshot.
   * All three fields are absent on the first snapshot for a symbol.
   */
  changeNarrative?: string | null;
  addedDriverChanges?: Array<{
    canonicalKey: string;
    title: string;
    driverType: "company" | "sector" | "macro";
  }>;
  removedDriverChanges?: Array<{
    canonicalKey: string;
    title: string;
    driverType: "company" | "sector" | "macro";
  }>;
};
