import Anthropic from "@anthropic-ai/sdk";
import { llmConsolidationSchema } from "@/lib/schemas/driver-consolidation";
import type { LLMDriver } from "@/lib/schemas/driver-consolidation";
import type {
  AnalysisInput,
  ScoredArticle,
  CandidateDriver,
  ConsolidationResult,
} from "@/lib/types/analysis";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DRIVERS = 3;

// ---------------------------------------------------------------------------
// System prompt — cluster only, never invent
// ---------------------------------------------------------------------------

const CONSOLIDATION_SYSTEM_PROMPT = `You are a financial evidence clustering engine. Your job is to group pre-scored news articles into 1–3 candidate drivers that explain a stock's price move.

RULES:
1. Only reference articles by index from the supplied list. Never invent events or cite sources not in the list.
2. Prefer company-specific drivers when direct evidence exists (direct_evidence articles).
3. Only create a sector driver when 2+ articles from different sources point to the same sector trend.
4. Only create a macro driver when no company or sector explanation is adequate.
5. If evidence is weak across all articles, return an empty drivers array and reasoningType "unclear".
6. Each driver must cite at least one article index in evidenceArticleIndices.
7. An article index can appear in multiple drivers if it supports both.
8. inferenceLevel:
   "direct"     — at least one supporting article is company-specific (relationType = company)
   "supporting" — all supporting articles are sector or macro
9. Return no more than ${MAX_DRIVERS} drivers, ranked strongest first.
10. Return ONLY valid JSON. No markdown, no code fences.

JSON SCHEMA:
{
  "drivers": [
    {
      "title": string,              // ≤8 words
      "driverType": "company" | "sector" | "macro",
      "evidenceArticleIndices": number[],
      "inferenceLevel": "direct" | "supporting",
      "explanation": string         // 1–2 sentences, grounded in supplied evidence
    }
  ],
  "reasoningType": "company" | "sector" | "macro" | "company_and_sector" | "unclear"
}`;

// ---------------------------------------------------------------------------
// Strength calculation — deterministic, not LLM-reported
// ---------------------------------------------------------------------------

/**
 * Compute driver strength from the relevance scores of its supporting articles.
 *
 *   base    = average normalised relevance of supporting articles (0–1)
 *   count   = small logarithmic bonus for corroborating sources
 *   direct  = +0.1 bonus when at least one article is direct_evidence
 *
 * Result is clamped to [0, 1].
 */
function computeStrength(
  indices: number[],
  scoredArticles: ScoredArticle[]
): number {
  const articles = indices
    .map((i) => scoredArticles.find((a) => a.articleIndex === i))
    .filter(Boolean) as ScoredArticle[];

  if (articles.length === 0) return 0;

  const avgRelevance =
    articles.reduce((sum, a) => sum + a.relevance, 0) / articles.length;
  const base = avgRelevance / 5;

  // Each additional article beyond the first adds a diminishing bonus
  const countBonus = Math.min(0.2, 0.07 * (articles.length - 1));

  const directBonus = articles.some((a) => a.usefulness === "direct_evidence")
    ? 0.1
    : 0;

  return Math.min(1, base + countBonus + directBonus);
}

// ---------------------------------------------------------------------------
// Mock fallback — deterministic grouping by candidateDriver label
// ---------------------------------------------------------------------------

function getMockConsolidation(
  scoredArticles: ScoredArticle[]
): ConsolidationResult {
  if (scoredArticles.length === 0) {
    return { drivers: [], reasoningType: "unclear" };
  }

  // Group by candidateDriver label from article-scoring step
  const groups = new Map<string, ScoredArticle[]>();
  for (const article of scoredArticles) {
    const label = article.candidateDriver || "General news";
    const group = groups.get(label) ?? [];
    group.push(article);
    groups.set(label, group);
  }

  const drivers: CandidateDriver[] = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, MAX_DRIVERS)
    .map(([label, articles]) => {
      const indices = articles.map((a) => a.articleIndex);
      const hasCompany = articles.some((a) => a.relationType === "company");
      return {
        title: label,
        explanation: articles[0]?.rationale ?? "No explanation available.",
        supportingArticles: articles,
        evidenceArticleIndices: indices,
        driverType: hasCompany
          ? "company"
          : articles[0]?.relationType === "macro"
          ? "macro"
          : "sector",
        strength: computeStrength(indices, scoredArticles),
        inferenceLevel: hasCompany ? "direct" : "supporting",
      };
    });

  const hasCompany = drivers.some((d) => d.driverType === "company");
  const hasSector = drivers.some((d) => d.driverType === "sector");

  return {
    drivers,
    reasoningType:
      hasCompany && hasSector
        ? "company_and_sector"
        : hasCompany
        ? "company"
        : hasSector
        ? "sector"
        : "macro",
  };
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
    `\n[driver-consolidation] ${symbol} — ${result.drivers.length} driver(s) | reasoningType=${result.reasoningType}`
  );
  console.log("─".repeat(72));

  result.drivers.forEach((d, i) => {
    console.log(
      `  ${i + 1}. [${d.driverType}/${d.inferenceLevel}] strength=${d.strength.toFixed(2)} — ${d.title}`
    );
    console.log(`     evidence: [${d.evidenceArticleIndices.join(", ")}]`);
    console.log(`     ${d.explanation}`);
  });

  console.log("─".repeat(72) + "\n");
}

// ---------------------------------------------------------------------------
// Main consolidation function
// ---------------------------------------------------------------------------

/**
 * Group scored articles into 1–3 candidate price-move drivers.
 *
 * The LLM acts as a clustering engine only — it identifies which articles
 * point to the same underlying event, not what caused the stock to move.
 * `strength` is computed deterministically from article relevance scores
 * so the model cannot inflate driver confidence.
 */
export async function consolidateDrivers(
  scoredArticles: ScoredArticle[],
  input: AnalysisInput
): Promise<ConsolidationResult> {
  if (scoredArticles.length === 0) {
    return { drivers: [], reasoningType: "unclear" };
  }

  if (process.env.USE_MOCK_DATA === "true" || !process.env.ANTHROPIC_API_KEY) {
    return getMockConsolidation(scoredArticles);
  }

  const { price, company } = input;
  const direction = price.changePercent >= 0 ? "UP" : "DOWN";
  const absPercent = Math.abs(price.changePercent).toFixed(2);

  // Build prompt: give the LLM only what it needs — pre-scored article summaries
  let userPrompt =
    `STOCK: ${company.companyName} (${price.symbol})\n` +
    `SECTOR: ${company.sector || "Unknown"}\n` +
    `PRICE MOVE: ${direction} ${absPercent}% on ${price.asOf}\n\n` +
    `Pre-scored articles (already filtered for relevance):\n\n`;

  scoredArticles.forEach((a) => {
    userPrompt +=
      `[${a.articleIndex}] ${a.title}\n` +
      `  relationType=${a.relationType} | relevance=${a.relevance}/5 | usefulness=${a.usefulness}\n` +
      `  candidateDriver: "${a.candidateDriver}"\n` +
      `  rationale: ${a.rationale}\n\n`;
  });

  userPrompt +=
    `Group these ${scoredArticles.length} article(s) into at most ${MAX_DRIVERS} drivers. ` +
    `Return JSON only.`;

  // Call LLM
  let rawContent: string;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: CONSOLIDATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text block in response");
    }
    rawContent = textBlock.text.trim();
  } catch (err) {
    console.warn(
      "[driver-consolidation] LLM call failed, falling back to mock:",
      err instanceof Error ? err.message : err
    );
    return getMockConsolidation(scoredArticles);
  }

  // Strip markdown fences if present
  if (rawContent.startsWith("```")) {
    rawContent = rawContent
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "");
  }

  // Parse + validate
  let llmResult;
  try {
    llmResult = llmConsolidationSchema.parse(JSON.parse(rawContent));
  } catch (err) {
    console.warn(
      "[driver-consolidation] Failed to parse consolidation response, falling back to mock:",
      err instanceof Error ? err.message : err
    );
    return getMockConsolidation(scoredArticles);
  }

  // Map LLM output → CandidateDriver with deterministic strength
  const drivers: CandidateDriver[] = llmResult.drivers
    .filter((d: LLMDriver) => d.evidenceArticleIndices.length > 0)
    .map((d: LLMDriver) => {
      const indices = d.evidenceArticleIndices.filter(
        (i) => i < scoredArticles.length || scoredArticles.some((a) => a.articleIndex === i)
      );
      const supporting = indices
        .map((i) => scoredArticles.find((a) => a.articleIndex === i))
        .filter(Boolean) as ScoredArticle[];

      return {
        title: d.title,
        explanation: d.explanation,
        supportingArticles: supporting,
        evidenceArticleIndices: indices,
        driverType: d.driverType,
        strength: computeStrength(indices, scoredArticles),
        inferenceLevel: d.inferenceLevel,
      };
    })
    .sort((a, b) => b.strength - a.strength);

  const result: ConsolidationResult = {
    drivers,
    reasoningType: llmResult.reasoningType,
  };

  logConsolidation(price.symbol, result);

  return result;
}
