import Anthropic from "@anthropic-ai/sdk";
import { explanationSchema } from "@/lib/schemas/explanation";
import { validationFailed } from "@/lib/errors";
import type {
  AnalysisInput,
  ScoredArticle,
  CandidateDriver,
  ExplanationResult,
} from "@/lib/types/analysis";

// ---------------------------------------------------------------------------
// System prompt — unchanged from the original explain.ts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a cautious financial research assistant that explains likely causes of stock price movements based on supplied evidence. You do not make predictions or unsupported claims.

RULES:
1. Rely ONLY on the context provided. Do not reference knowledge beyond what is given.
2. Distinguish between company-specific and sector-wide drivers.
3. Always be appropriately uncertain. Never state causation as fact.
4. If evidence is weak or absent, explicitly say "no clear catalyst was identified."
5. Rank drivers by likelihood based on the evidence strength.
6. Return ONLY valid JSON matching the required schema. No markdown, no code fences.
7. Use hedging language: "likely driven by", "appears related to", "may reflect".
8. Do not invent causal claims not supported by the provided articles.
9. The "summary" should be one concise sentence.
10. Provide 1-3 drivers, ranked by relevance.
11. Set confidence to "low" if evidence is sparse, "medium" if some supporting news exists, "high" only if strong direct evidence is found.
12. Set reasoningType based on the evidence pattern:
    - "company" if drivers are company-specific
    - "sector" if the move mirrors peers/sector
    - "macro" if driven by broad market forces
    - "company_and_sector" if both apply
    - "unclear" if no clear pattern

JSON SCHEMA:
{
  "summary": string,
  "drivers": [{ "title": string, "explanation": string, "evidenceArticleIndices": number[] }],
  "confidence": "low" | "medium" | "high",
  "reasoningType": "company" | "sector" | "macro" | "company_and_sector" | "unclear",
  "caveats": string[]
}`;

// ---------------------------------------------------------------------------
// Prompt builder — adapted from buildUserPrompt() in explain.ts.
// Now receives scored articles and a pre-computed confidence hint.
// ---------------------------------------------------------------------------

function buildPrompt(
  input: AnalysisInput,
  scoredArticles: ScoredArticle[],
  drivers: CandidateDriver[],
  precomputedConfidence: "low" | "medium" | "high"
): string {
  const { price, company, peers } = input;
  const direction = price.changePercent >= 0 ? "UP" : "DOWN";
  const absPercent = Math.abs(price.changePercent).toFixed(2);

  let prompt = `STOCK: ${company.companyName} (${price.symbol})
SECTOR: ${company.sector || "Unknown"} | INDUSTRY: ${company.industry || "Unknown"}
PRICE MOVE: ${direction} ${absPercent}% (from $${price.previousClose.toFixed(2)} to $${price.currentPrice.toFixed(2)})
AS OF: ${price.asOf}
PRE-COMPUTED CONFIDENCE HINT: ${precomputedConfidence} (based on article count and evidence strength)

RECENT NEWS ARTICLES (sorted by relevance score):
`;

  // Use scored articles, surfacing relevance signals to the model
  const sorted = [...scoredArticles].sort(
    (a, b) => b.relevanceScore - a.relevanceScore
  );

  if (sorted.length === 0) {
    prompt += "No recent news articles were found for this company.\n";
  } else {
    sorted.forEach((article, i) => {
      prompt += `[${i}] "${article.title}" - ${article.source} (${article.publishedAt})`;
      if (article.summary) {
        prompt += `\n    Summary: ${article.summary}`;
      }
      prompt += "\n";
    });
  }

  // Inject any pre-computed drivers as grounding hints (currently empty stub)
  if (drivers.length > 0) {
    prompt += "\nPRE-IDENTIFIED DRIVERS (use as grounding, do not invent beyond these):\n";
    drivers.forEach((d, i) => {
      prompt += `  [Driver ${i + 1}] ${d.title} (${d.driverType}, score: ${d.rawScore.toFixed(2)})\n`;
      prompt += `    ${d.explanation}\n`;
    });
  }

  prompt += "\nPEER/SECTOR CONTEXT:\n";
  if (peers.peers.length === 0) {
    prompt += "No peer data available.\n";
  } else {
    peers.peers.forEach((p) => {
      const pChange =
        p.changePercent !== undefined
          ? `${p.changePercent >= 0 ? "+" : ""}${p.changePercent.toFixed(2)}%`
          : "N/A";
      prompt += `  ${p.symbol}: ${pChange}\n`;
    });
    if (peers.sectorSummary) {
      prompt += `  Sector note: ${peers.sectorSummary}\n`;
    }
  }

  prompt +=
    "\nBased on the above context, explain why this stock is moving today. Return JSON only.";

  return prompt;
}

// ---------------------------------------------------------------------------
// Mock fallback — adapted from getMockExplanation() in explain.ts
// ---------------------------------------------------------------------------

function getMockResult(
  input: AnalysisInput,
  precomputedConfidence: "low" | "medium" | "high"
): ExplanationResult {
  const { price, company, articles } = input;
  const direction = price.changePercent >= 0 ? "up" : "down";
  const hasArticles = articles.length > 0;

  const base = hasArticles
    ? {
        summary: `${company.companyName} is ${direction} ${Math.abs(price.changePercent).toFixed(1)}% today, likely driven by recent news and ${company.sector?.toLowerCase() || "sector"} sentiment.`,
        drivers: articles.slice(0, 3).map((article, i) => ({
          title:
            article.title.length > 60
              ? article.title.slice(0, 57) + "..."
              : article.title,
          explanation:
            article.summary ||
            `Recent reporting from ${article.source} appears relevant to today's move.`,
          evidenceArticleIndices: [i],
        })),
        confidence: precomputedConfidence,
        reasoningType: "company_and_sector" as const,
        caveats: [
          "This explanation is based on available news and may not capture all factors.",
          "Correlation with news does not imply direct causation.",
        ],
      }
    : {
        summary: `${company.companyName} is ${direction} ${Math.abs(price.changePercent).toFixed(1)}% today with no clear company-specific catalyst identified.`,
        drivers: [
          {
            title: "Broader market movement",
            explanation:
              "The move appears to be in line with broader market trends in the absence of company-specific news.",
            evidenceArticleIndices: [],
          },
        ],
        confidence: "low" as const,
        reasoningType: "unclear" as const,
        caveats: [
          "No recent company-specific news was found.",
          "The move may be driven by factors not captured in available data.",
        ],
      };

  return {
    ...base,
    pipelineMetadata: {
      articlesScored: articles.length,
      candidateDriversConsidered: 0,
      computedAt: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Main synthesis function
// ---------------------------------------------------------------------------

/**
 * Call the LLM to synthesize a final explanation from pre-processed inputs.
 *
 * Receives scored articles, pre-computed drivers, and a deterministic
 * confidence value so the LLM is constrained by upstream evidence rather
 * than free to self-report confidence.
 *
 * Falls back to a rule-based mock explanation if the API is unavailable.
 */
export async function synthesize(
  input: AnalysisInput,
  scoredArticles: ScoredArticle[],
  drivers: CandidateDriver[],
  precomputedConfidence: "low" | "medium" | "high"
): Promise<ExplanationResult> {
  const pipelineMetadata = {
    articlesScored: scoredArticles.length,
    candidateDriversConsidered: drivers.length,
    computedAt: new Date().toISOString(),
  };

  if (process.env.USE_MOCK_DATA === "true" || !process.env.ANTHROPIC_API_KEY) {
    return getMockResult(input, precomputedConfidence);
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const userPrompt = buildPrompt(input, scoredArticles, drivers, precomputedConfidence);

  let rawContent: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from AI model");
    }
    rawContent = textBlock.text;
  } catch (err) {
    console.warn(
      "Anthropic API failed, falling back to mock explanation:",
      err instanceof Error ? err.message : err
    );
    return getMockResult(input, precomputedConfidence);
  }

  // Strip markdown code fences if present
  let jsonStr = rawContent.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw validationFailed("Anthropic", "Response was not valid JSON");
  }

  const validated = explanationSchema.safeParse(parsed);
  if (!validated.success) {
    throw validationFailed("Anthropic", validated.error.message);
  }

  return { ...validated.data, pipelineMetadata };
}
