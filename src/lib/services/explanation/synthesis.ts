import Anthropic from "@anthropic-ai/sdk";
import { synthesisOutputSchema } from "@/lib/schemas/explanation";
import { validationFailed } from "@/lib/errors";
import type {
  AnalysisInput,
  ScoredArticle,
  CandidateDriver,
  ExplanationResult,
  ConsolidationResult,
} from "@/lib/types/analysis";

// ---------------------------------------------------------------------------
// System prompt — writer role only
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a financial research writer. Your only job is to write clear, evidence-grounded explanations of stock price movements using pre-identified drivers.

ROLE BOUNDARY:
- You write explanation text. You do NOT evaluate evidence quality.
- You do NOT determine confidence. It has already been computed.
- You do NOT add, rename, or remove drivers. Use only the drivers given.

WRITING RULES:
1. Explain using ONLY the drivers listed. Do not introduce new events or claims.
2. For each driver, write a 1–2 sentence explanation grounded in the listed article evidence.
3. Distinguish inference level in your prose:
   "direct"     — company-specific evidence: "According to [source], [company] reported..."
   "supporting" — sector/macro context: "Broader [sector] trends suggest..." or "Macro pressure from..."
4. If no drivers are provided, write summary: "No clear catalyst was identified for this move."
   and include one driver titled "Insufficient evidence" with a brief explanation.
5. The summary must be one sentence: state the direction, primary driver, and appropriate uncertainty.
   Example: "[Company] fell X% today, likely driven by [primary driver], though the evidence remains mixed."
6. Caveats: note gaps in evidence, whether the move may reflect broader sentiment, or limitations of available data.
   Write 1–3 caveats. Do not repeat the summary.
7. Use hedging language throughout: "likely driven by", "appears related to", "may reflect", "suggests".
8. Never state causation as fact. Correlation with news does not imply causation.
9. Return ONLY valid JSON. No markdown. No code fences. No extra keys.

JSON SCHEMA (return exactly this shape):
{
  "summary": string,
  "drivers": [
    {
      "title": string,
      "explanation": string,
      "evidenceArticleIndices": number[]
    }
  ],
  "caveats": string[]
}`;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(
  input: AnalysisInput,
  scoredArticles: ScoredArticle[],
  drivers: CandidateDriver[],
  precomputedConfidence: "low" | "medium" | "high",
  precomputedReasoningType: string
): string {
  const { price, company, peers } = input;
  const direction = price.changePercent >= 0 ? "UP" : "DOWN";
  const absPercent = Math.abs(price.changePercent).toFixed(2);

  let prompt =
    `STOCK: ${company.companyName} (${price.symbol})\n` +
    `SECTOR: ${company.sector || "Unknown"} | INDUSTRY: ${company.industry || "Unknown"}\n` +
    `PRICE MOVE: ${direction} ${absPercent}% ` +
    `(from $${price.previousClose.toFixed(2)} to $${price.currentPrice.toFixed(2)}) on ${price.asOf}\n` +
    `CONFIDENCE (pre-computed, do not override): ${precomputedConfidence}\n` +
    `REASONING TYPE (pre-computed, do not override): ${precomputedReasoningType}\n`;

  // Peer context — helps writer distinguish company vs sector moves
  if (peers.peers.length > 0) {
    prompt += "\nPEER MOVES (for context only):\n";
    peers.peers.forEach((p) => {
      const pChange =
        p.changePercent !== undefined
          ? `${p.changePercent >= 0 ? "+" : ""}${p.changePercent.toFixed(2)}%`
          : "N/A";
      prompt += `  ${p.symbol}: ${pChange}\n`;
    });
    if (peers.sectorSummary) {
      prompt += `  Note: ${peers.sectorSummary}\n`;
    }
  }

  // Pre-computed drivers with their supporting article context
  if (drivers.length === 0) {
    prompt +=
      "\nNO DRIVERS WERE IDENTIFIED. Write a 'no clear catalyst' explanation.\n";
  } else {
    prompt +=
      `\nPRE-IDENTIFIED DRIVERS — write explanations for these ${drivers.length} driver(s) only:\n`;

    drivers.forEach((d, i) => {
      prompt +=
        `\n[Driver ${i + 1}] ${d.title}\n` +
        `  driverType: ${d.driverType} | inferenceLevel: ${d.inferenceLevel} | strength: ${d.strength.toFixed(2)}\n`;

      // Show the articles that support this driver
      const supporting = d.evidenceArticleIndices
        .map((idx) => scoredArticles.find((a) => a.articleIndex === idx))
        .filter(Boolean) as ScoredArticle[];

      if (supporting.length > 0) {
        prompt += `  Supporting evidence:\n`;
        supporting.forEach((a) => {
          prompt += `    [${a.articleIndex}] "${a.title}" — ${a.source} (${a.publishedAt})\n`;
          if (a.summary) {
            prompt += `           ${a.summary}\n`;
          }
        });
      } else {
        prompt += `  No supporting articles found — note the evidence gap in your explanation.\n`;
      }
    });
  }

  prompt +=
    "\nWrite explanations for the drivers above. Keep each explanation to 1–2 sentences. " +
    "Return JSON only — no markdown, no extra keys.";

  return prompt;
}

// ---------------------------------------------------------------------------
// Mock fallback
// ---------------------------------------------------------------------------

function getMockResult(
  input: AnalysisInput,
  drivers: CandidateDriver[],
  precomputedConfidence: "low" | "medium" | "high",
  precomputedReasoningType: ConsolidationResult["reasoningType"]
): ExplanationResult {
  const { price, company } = input;
  const direction = price.changePercent >= 0 ? "up" : "down";
  const pct = Math.abs(price.changePercent).toFixed(1);

  const mockDrivers =
    drivers.length > 0
      ? drivers.map((d) => ({
          title: d.title,
          explanation:
            d.explanation ||
            `Recent developments appear relevant to this move, though the connection remains uncertain.`,
          evidenceArticleIndices: d.evidenceArticleIndices,
        }))
      : [
          {
            title: "Broader market movement",
            explanation:
              "The move appears to be in line with broader market trends in the absence of company-specific news.",
            evidenceArticleIndices: [],
          },
        ];

  return {
    summary:
      drivers.length > 0
        ? `${company.companyName} is ${direction} ${pct}% today, likely driven by ${drivers[0].title.toLowerCase()}, though additional factors may be at play.`
        : `${company.companyName} is ${direction} ${pct}% today with no clear company-specific catalyst identified.`,
    drivers: mockDrivers,
    confidence: precomputedConfidence,
    reasoningType: precomputedReasoningType,
    caveats: [
      "This explanation is based on available news and may not capture all factors.",
      "Correlation with news does not imply direct causation.",
    ],
    pipelineMetadata: {
      articlesScored: input.articles.length,
      candidateDriversConsidered: drivers.length,
      computedAt: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Main synthesis function
// ---------------------------------------------------------------------------

/**
 * Call the LLM to write explanation prose from pre-identified drivers.
 *
 * The model's role is strictly as a writer:
 *   - It receives pre-computed drivers (title, type, strength, evidence articles)
 *   - It writes a summary sentence, per-driver explanations, and caveats
 *   - It does NOT determine confidence or reasoningType — those are injected
 *     after the call from pre-computed upstream values
 *
 * This prevents the model from inflating confidence or inventing causal stories
 * not supported by the scored article evidence.
 */
export async function synthesize(
  input: AnalysisInput,
  scoredArticles: ScoredArticle[],
  drivers: CandidateDriver[],
  precomputedConfidence: "low" | "medium" | "high",
  precomputedReasoningType: ConsolidationResult["reasoningType"] = "unclear"
): Promise<ExplanationResult> {
  const pipelineMetadata = {
    articlesScored: scoredArticles.length,
    candidateDriversConsidered: drivers.length,
    computedAt: new Date().toISOString(),
  };

  if (process.env.USE_MOCK_DATA === "true" || !process.env.ANTHROPIC_API_KEY) {
    return getMockResult(input, drivers, precomputedConfidence, precomputedReasoningType);
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const userPrompt = buildPrompt(
    input,
    scoredArticles,
    drivers,
    precomputedConfidence,
    precomputedReasoningType
  );

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
      throw new Error("No text response from model");
    }
    rawContent = textBlock.text.trim();
  } catch (err) {
    console.warn(
      "[synthesis] LLM call failed, falling back to mock:",
      err instanceof Error ? err.message : err
    );
    return getMockResult(input, drivers, precomputedConfidence, precomputedReasoningType);
  }

  // Strip markdown fences if present
  if (rawContent.startsWith("```")) {
    rawContent = rawContent
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw validationFailed("Anthropic", "Synthesis response was not valid JSON");
  }

  // Validate only the LLM-generated fields
  const validated = synthesisOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw validationFailed("Anthropic", validated.error.message);
  }

  // Assemble final result — inject pre-computed values, never trust LLM for these
  return {
    ...validated.data,
    confidence: precomputedConfidence,
    reasoningType: precomputedReasoningType,
    pipelineMetadata,
  };
}
