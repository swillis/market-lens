import type {
  AnalysisInput,
  ScoredArticle,
  CandidateDriver,
  ConfidenceResult,
} from "@/lib/types/analysis";

// ---------------------------------------------------------------------------
// Component weights — must sum to 1.0 before modifiers
// ---------------------------------------------------------------------------

const EVIDENCE_WEIGHT = 0.40; // Article relevance quality
const DRIVER_WEIGHT   = 0.35; // Pre-computed driver strength
const VOLUME_WEIGHT   = 0.15; // Corroborating source count
const TYPE_WEIGHT     = 0.10; // Company vs sector vs macro reliability

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const HIGH_THRESHOLD   = 0.75;
const MEDIUM_THRESHOLD = 0.45;

// ---------------------------------------------------------------------------
// Component calculators
// ---------------------------------------------------------------------------

/**
 * Component 1 — Evidence quality (0–EVIDENCE_WEIGHT)
 *
 * Weighted average normalised relevance across all scored articles.
 * direct_evidence articles count at full weight; supporting_context at half.
 * Rewards high-relevance, company-specific reporting over weak context.
 */
function evidenceQualityScore(articles: ScoredArticle[]): number {
  if (articles.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const a of articles) {
    const usefulnessWeight = a.usefulness === "direct_evidence" ? 1.0 : 0.5;
    weightedSum += (a.relevance / 5) * usefulnessWeight;
    totalWeight += usefulnessWeight;
  }

  return (weightedSum / totalWeight) * EVIDENCE_WEIGHT;
}

/**
 * Component 2 — Driver signal strength (0–DRIVER_WEIGHT)
 *
 * Average driver strength, multiplied by an inference-level factor.
 * direct drivers (company-specific evidence) count at 1.0×;
 * supporting drivers (sector/macro inference) count at 0.75×.
 */
function driverStrengthScore(drivers: CandidateDriver[]): number {
  if (drivers.length === 0) return 0;

  const total = drivers.reduce((sum, d) => {
    const inferenceMultiplier = d.inferenceLevel === "direct" ? 1.0 : 0.75;
    return sum + d.strength * inferenceMultiplier;
  }, 0);

  return (total / drivers.length) * DRIVER_WEIGHT;
}

/**
 * Component 3 — Volume bonus (0–VOLUME_WEIGHT)
 *
 * Diminishing returns: 5 articles captures the full bonus.
 * More corroborating sources raise confidence; one lone article keeps it modest.
 */
function volumeScore(articles: ScoredArticle[]): number {
  return Math.min(1, articles.length / 5) * VOLUME_WEIGHT;
}

/**
 * Component 4 — Evidence type reliability (−0.10 to +TYPE_WEIGHT)
 *
 * Company-specific direct evidence is the most reliable signal.
 * Pure macro inference (no company articles) is the least.
 *
 *  +0.10  — at least one direct_evidence article (most reliable)
 *  +0.05  — company relationType but no direct_evidence
 *   0.00  — mix of company and sector
 *  −0.05  — all sector/macro drivers, some company articles present
 *  −0.10  — all drivers are macro-only (weakest inference)
 */
function typeReliabilityScore(
  articles: ScoredArticle[],
  drivers: CandidateDriver[]
): number {
  const hasDirectEvidence = articles.some(
    (a) => a.usefulness === "direct_evidence"
  );
  const hasCompanyArticle = articles.some(
    (a) => a.relationType === "company"
  );

  if (hasDirectEvidence)  return  TYPE_WEIGHT;        // +0.10
  if (hasCompanyArticle)  return  TYPE_WEIGHT * 0.5;  // +0.05

  // No company articles — look at driver types
  if (drivers.length === 0) return 0;

  const allMacro   = drivers.every((d) => d.driverType === "macro");
  const allNonComp = drivers.every((d) => d.driverType !== "company");

  if (allMacro)    return -TYPE_WEIGHT;        // −0.10
  if (allNonComp)  return -TYPE_WEIGHT * 0.5;  // −0.05
  return 0;
}

/**
 * Conflict penalty (0 to −0.10)
 *
 * When 2+ drivers exist with mixed types AND similar strengths,
 * the evidence is ambiguous — we can't clearly attribute the move.
 * If one driver clearly dominates, we apply a smaller penalty.
 */
function conflictPenalty(drivers: CandidateDriver[]): number {
  if (drivers.length < 2) return 0;

  const types = new Set(drivers.map((d) => d.driverType));
  if (types.size <= 1) return 0; // All same type — no conflict

  const strengths = drivers.map((d) => d.strength);
  const spread = Math.max(...strengths) - Math.min(...strengths);

  // Similar strengths across different types = genuine ambiguity
  if (spread < 0.20) return -0.10;
  // One driver dominates but types still differ — mild conflict
  return -0.05;
}

// ---------------------------------------------------------------------------
// Dev logging
// ---------------------------------------------------------------------------

function logConfidence(
  symbol: string,
  components: {
    evidence: number;
    driver: number;
    volume: number;
    type: number;
    conflict: number;
  },
  result: ConfidenceResult
): void {
  if (process.env.NODE_ENV !== "development") return;

  const { evidence, driver, volume, type, conflict } = components;
  const raw = evidence + driver + volume + type + conflict;

  console.log(`\n[confidence] ${symbol}`);
  console.log("─".repeat(52));
  console.log(`  evidence quality  ${evidence.toFixed(3)}  (weight ${EVIDENCE_WEIGHT})`);
  console.log(`  driver strength   ${driver.toFixed(3)}  (weight ${DRIVER_WEIGHT})`);
  console.log(`  volume bonus      ${volume.toFixed(3)}  (weight ${VOLUME_WEIGHT})`);
  console.log(`  type reliability  ${type >= 0 ? "+" : ""}${type.toFixed(3)}`);
  console.log(`  conflict penalty  ${conflict.toFixed(3)}`);
  console.log("  " + "─".repeat(30));
  console.log(`  raw score         ${raw.toFixed(3)}`);
  console.log(`  clamped score     ${result.confidenceScore.toFixed(3)}`);
  console.log(`  label             ${result.confidenceLabel.toUpperCase()}`);
  console.log("─".repeat(52) + "\n");
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Deterministically calculate a confidence score from structured pipeline signals.
 *
 * The LLM never touches this value — it receives the pre-computed label as
 * a hard constraint in the synthesis prompt, preventing self-reported inflation.
 *
 * Score composition:
 *   evidence quality  0–0.40   weighted article relevance (direct_evidence counts 2×)
 *   driver strength   0–0.35   avg driver strength × inference-level multiplier
 *   volume bonus      0–0.15   corroborating source count (saturates at 5 articles)
 *   type reliability  ±0.10    company > sector > macro signal reliability
 *   conflict penalty  0–−0.10  mixed drivers with similar strength = ambiguous signal
 *
 * Thresholds:  score ≥ 0.75 → high  |  score ≥ 0.45 → medium  |  else → low
 */
export function calculateConfidence(
  scoredArticles: ScoredArticle[],
  drivers: CandidateDriver[],
  input: AnalysisInput
): ConfidenceResult {
  const components = {
    evidence: evidenceQualityScore(scoredArticles),
    driver:   driverStrengthScore(drivers),
    volume:   volumeScore(scoredArticles),
    type:     typeReliabilityScore(scoredArticles, drivers),
    conflict: conflictPenalty(drivers),
  };

  const rawScore = Object.values(components).reduce((a, b) => a + b, 0);
  const confidenceScore = Math.max(0, Math.min(1, rawScore));

  const confidenceLabel: "low" | "medium" | "high" =
    confidenceScore >= HIGH_THRESHOLD   ? "high"   :
    confidenceScore >= MEDIUM_THRESHOLD ? "medium" : "low";

  const result: ConfidenceResult = { confidenceScore, confidenceLabel };

  logConfidence(input.price.symbol, components, result);

  return result;
}
