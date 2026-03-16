import Anthropic from "@anthropic-ai/sdk";
import { articleScoresSchema } from "@/lib/schemas/article-scoring";
import type { AnalysisInput, ScoredArticle } from "@/lib/types/analysis";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ARTICLES_TO_RETURN = 8;
const MIN_RELEVANCE_THRESHOLD = 1; // Articles with relevance <= this are filtered out

// ---------------------------------------------------------------------------
// System prompt — scorer role only, NOT an explainer
// ---------------------------------------------------------------------------

const SCORING_SYSTEM_PROMPT = `You are a financial news relevance scorer. Your only job is to evaluate whether each article helps explain a specific stock's price movement on a given day.

You are NOT explaining the stock move. You are ONLY judging each article's relevance.

SCORING RULES:
- Score each article from 0–5:
    5 = Direct evidence (e.g. earnings release, guidance change, M&A news for this company)
    4 = Strong supporting evidence (e.g. analyst upgrade/downgrade, regulatory ruling, product news)
    3 = Useful context (e.g. sector peer results, industry trend directly affecting this company)
    2 = Weak context (e.g. broad sector commentary, macro news with indirect connection)
    1 = Tenuous (e.g. general market sentiment, loosely related industry news)
    0 = Unrelated (ignore entirely)

- relationType rules:
    "company"   — article is specific to this company
    "sector"    — article covers the sector or a direct competitor
    "macro"     — article covers broad market, rates, or macro forces
    "unrelated" — article has no meaningful connection

- usefulness rules:
    "direct_evidence"    — score 4–5, company-specific
    "supporting_context" — score 2–3, sector/macro with clear relevance
    "irrelevant"         — score 0–1, or unrelated type

- candidateDriver: a short label (5 words max) for what price driver this article points to.
  Use empty string "" if the article is irrelevant.

- rationale: one sentence explaining your score. Be specific. Do not speculate beyond the article text.

IMPORTANT:
- Prefer company-specific evidence over sector or macro signals.
- Do not mark an article as direct_evidence unless it is clearly about THIS company.
- Do not invent connections. If uncertain, score lower.
- Return ONLY valid JSON. No markdown. No extra commentary.

OUTPUT FORMAT:
[
  {
    "articleIndex": <number>,
    "relevance": <0–5>,
    "relationType": "company" | "sector" | "macro" | "unrelated",
    "usefulness": "direct_evidence" | "supporting_context" | "irrelevant",
    "candidateDriver": "<short label or empty string>",
    "rationale": "<one sentence>"
  },
  ...
]
Return one entry per article in the input, in the same order.`;

// ---------------------------------------------------------------------------
// Mock fallback
// ---------------------------------------------------------------------------

function getMockScoredArticles(input: AnalysisInput): ScoredArticle[] {
  return input.articles.map((article, i) => ({
    ...article,
    articleIndex: i,
    relevance: 3,
    relevanceScore: 0.6,
    relationType: "company" as const,
    usefulness: "supporting_context" as const,
    candidateDriver: "General news",
    rationale: "Mock scoring — API key not available.",
  }));
}

// ---------------------------------------------------------------------------
// Dev logging
// ---------------------------------------------------------------------------

function logScoringResults(
  symbol: string,
  scored: ScoredArticle[],
  filtered: ScoredArticle[]
): void {
  if (process.env.NODE_ENV !== "development") return;

  console.log(`\n[article-scoring] ${symbol} — ${scored.length} articles scored, ${filtered.length} kept after filtering`);
  console.log("─".repeat(72));

  scored.forEach((a) => {
    const kept = filtered.includes(a);
    const flag = kept ? "✓" : "✗";
    console.log(
      `${flag} [${a.articleIndex}] relevance=${a.relevance}/5 ` +
      `type=${a.relationType} usefulness=${a.usefulness}`
    );
    console.log(`    title:   ${a.title.slice(0, 80)}`);
    console.log(`    driver:  ${a.candidateDriver || "(none)"}`);
    console.log(`    reason:  ${a.rationale}`);
    console.log();
  });

  console.log("[article-scoring] kept articles:");
  filtered.forEach((a, i) => {
    console.log(`  ${i + 1}. [${a.articleIndex}] ${a.candidateDriver} — ${a.title.slice(0, 60)}`);
  });
  console.log("─".repeat(72) + "\n");
}

// ---------------------------------------------------------------------------
// Main scorer
// ---------------------------------------------------------------------------

/**
 * Score each article for relevance to the observed price move using the LLM.
 *
 * The LLM acts as a relevance judge only — it does not explain the move.
 * After scoring, articles with relevance ≤ 1 are discarded and the top 8
 * by relevance are returned to keep the synthesis prompt focused.
 */
export async function scoreArticles(
  input: AnalysisInput
): Promise<ScoredArticle[]> {
  if (input.articles.length === 0) return [];

  // Skip LLM in mock mode or when no API key is available
  if (process.env.USE_MOCK_DATA === "true" || !process.env.ANTHROPIC_API_KEY) {
    return getMockScoredArticles(input);
  }

  const { price, company, articles } = input;
  const direction = price.changePercent >= 0 ? "UP" : "DOWN";
  const absPercent = Math.abs(price.changePercent).toFixed(2);

  // Build the user prompt — context + all articles
  let userPrompt =
    `STOCK: ${company.companyName} (${price.symbol})\n` +
    `SECTOR: ${company.sector || "Unknown"} | INDUSTRY: ${company.industry || "Unknown"}\n` +
    `PRICE MOVE: ${direction} ${absPercent}% on ${price.asOf}\n\n` +
    `Score each of the following ${articles.length} article(s) for relevance to this price move:\n\n`;

  articles.forEach((article, i) => {
    userPrompt += `[${i}] Title: ${article.title}\n`;
    userPrompt += `    Source: ${article.source} | Published: ${article.publishedAt}\n`;
    if (article.summary) {
      userPrompt += `    Summary: ${article.summary}\n`;
    }
    userPrompt += "\n";
  });

  userPrompt += `Return a JSON array with one entry per article (indices 0–${articles.length - 1}).`;

  // Call the LLM
  let rawContent: string;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: SCORING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text block in response");
    }
    rawContent = textBlock.text.trim();
  } catch (err) {
    console.warn(
      "[article-scoring] LLM call failed, falling back to mock scores:",
      err instanceof Error ? err.message : err
    );
    return getMockScoredArticles(input);
  }

  // Strip markdown fences if present
  if (rawContent.startsWith("```")) {
    rawContent = rawContent
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "");
  }

  // Parse + validate
  let scores;
  try {
    scores = articleScoresSchema.parse(JSON.parse(rawContent));
  } catch (err) {
    console.warn(
      "[article-scoring] Failed to parse scoring response, falling back to mock scores:",
      err instanceof Error ? err.message : err
    );
    return getMockScoredArticles(input);
  }

  // Merge scores with original articles
  const scored: ScoredArticle[] = scores
    .filter((s) => s.articleIndex < articles.length)
    .map((s) => ({
      ...articles[s.articleIndex],
      articleIndex: s.articleIndex,
      relevance: s.relevance,
      relevanceScore: s.relevance / 5,
      relationType: s.relationType,
      usefulness: s.usefulness,
      candidateDriver: s.candidateDriver,
      rationale: s.rationale,
    }));

  // Filter noise and keep top N
  const filtered = scored
    .filter((a) => a.relevance > MIN_RELEVANCE_THRESHOLD)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, MAX_ARTICLES_TO_RETURN);

  logScoringResults(price.symbol, scored, filtered);

  return filtered;
}
