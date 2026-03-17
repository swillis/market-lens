/**
 * Driver consolidation — deterministic, no LLM.
 *
 * The article-scoring step already assigns a `candidateDriver` label to every
 * article. Consolidation groups articles by that label and computes driver
 * strength from their relevance scores. No second LLM call is needed.
 *
 * This was previously an LLM clustering step. Removing it:
 *   - saves one LLM call per fresh pipeline run
 *   - makes clustering reproducible and testable
 *   - keeps the driver titles stable (derived from the scorer's output)
 *
 * Upgrade path: if richer driver merging is needed later (e.g., deduplicating
 * semantically similar labels), a lightweight embedding-based step can be
 * inserted here without touching the upstream scorer or downstream synthesizer.
 */

import type {
  AnalysisInput,
  ScoredArticle,
  CandidateDriver,
  ConsolidationResult,
} from "@/lib/types/analysis";
import { generateCanonicalKey } from "@/lib/utils/canonical-key";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DRIVERS = 3;
const FALLBACK_LABEL = "General market news";

// ---------------------------------------------------------------------------
// Strength calculation — deterministic
// ---------------------------------------------------------------------------

/**
 * Compute driver strength from the relevance scores of its supporting articles.
 *
 *   base   = average normalised relevance across supporting articles (0–1)
 *   count  = diminishing bonus for corroborating sources (caps at 3 articles)
 *   direct = +0.10 bonus when at least one article is direct_evidence
 *
 * Result is clamped to [0, 1].
 */
function computeStrength(articles: ScoredArticle[]): number {
  if (articles.length === 0) return 0;

  const avgRelevance =
    articles.reduce((sum, a) => sum + a.relevance, 0) / articles.length;
  const base = avgRelevance / 5;
  const countBonus = Math.min(0.2, 0.07 * (articles.length - 1));
  const directBonus = articles.some((a) => a.usefulness === "direct_evidence")
    ? 0.1
    : 0;

  return Math.min(1, base + countBonus + directBonus);
}

// ---------------------------------------------------------------------------
// Reasoning type derivation — deterministic
// ---------------------------------------------------------------------------

function deriveReasoningType(
  drivers: CandidateDriver[]
): ConsolidationResult["reasoningType"] {
  if (drivers.length === 0) return "unclear";

  const types = new Set(drivers.map((d) => d.driverType));
  if (types.has("company") && types.has("sector")) return "company_and_sector";
  if (types.has("company")) return "company";
  if (types.has("sector")) return "sector";
  if (types.has("macro")) return "macro";
  return "unclear";
}

// ---------------------------------------------------------------------------
// Dev logging
// ---------------------------------------------------------------------------

function logConsolidation(
  symbol: string,
  result: ConsolidationResult
): void {
  if (process.env.NODE_ENV !== "development") return;

  console.log(
    `\n[driver-consolidation] ${symbol} — ${result.drivers.length} driver(s) | reasoningType=${result.reasoningType} | deterministic`
  );
  console.log("─".repeat(72));

  result.drivers.forEach((d, i) => {
    console.log(
      `  ${i + 1}. [${d.driverType}/${d.inferenceLevel}] strength=${d.strength.toFixed(2)} — ${d.title}`
    );
    console.log(`     key: ${d.canonicalKey}`);
    console.log(`     evidence: [${d.evidenceArticleIndices.join(", ")}]`);
  });

  console.log("─".repeat(72) + "\n");
}

// ---------------------------------------------------------------------------
// Main consolidation function — sync, no LLM
// ---------------------------------------------------------------------------

/**
 * Group scored articles into 1–3 candidate price-move drivers.
 *
 * Each article carries a `candidateDriver` label assigned by the scorer.
 * Articles with the same label are grouped together; strength is computed
 * deterministically from their relevance scores.
 *
 * This function is synchronous — it consumes the output of scoreArticles()
 * without making any additional API calls.
 */
export function consolidateDrivers(
  scoredArticles: ScoredArticle[],
  input: AnalysisInput
): ConsolidationResult {
  if (scoredArticles.length === 0) {
    return { drivers: [], reasoningType: "unclear" };
  }

  // Group by candidateDriver label (skip irrelevant articles)
  const groups = new Map<string, ScoredArticle[]>();

  for (const article of scoredArticles) {
    if (article.usefulness === "irrelevant") continue;
    const label = article.candidateDriver?.trim() || FALLBACK_LABEL;
    const group = groups.get(label) ?? [];
    group.push(article);
    groups.set(label, group);
  }

  // Build CandidateDriver for each group
  const drivers: CandidateDriver[] = [...groups.entries()]
    .map(([label, articles]) => {
      // Sort group articles by relevance — highest first
      const sorted = [...articles].sort((a, b) => b.relevance - a.relevance);

      const hasCompanyArticle = articles.some(
        (a) => a.relationType === "company"
      );
      const hasDirectEvidence = articles.some(
        (a) => a.usefulness === "direct_evidence"
      );

      const driverType: CandidateDriver["driverType"] = hasCompanyArticle
        ? "company"
        : sorted[0]?.relationType === "macro"
        ? "macro"
        : "sector";

      const inferenceLevel: CandidateDriver["inferenceLevel"] = hasDirectEvidence
        ? "direct"
        : "supporting";

      return {
        title: label,
        canonicalKey: generateCanonicalKey(label),
        // explanation prose is written by the synthesis step — empty here
        explanation: "",
        supportingArticles: sorted,
        evidenceArticleIndices: sorted.map((a) => a.articleIndex),
        driverType,
        strength: computeStrength(articles),
        inferenceLevel,
      };
    })
    // Rank strongest first, keep top MAX_DRIVERS
    .sort((a, b) => b.strength - a.strength)
    .slice(0, MAX_DRIVERS);

  const result: ConsolidationResult = {
    drivers,
    reasoningType: deriveReasoningType(drivers),
  };

  logConsolidation(input.price.symbol, result);

  return result;
}
