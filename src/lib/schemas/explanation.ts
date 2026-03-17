import { z } from "zod";

export const driverSchema = z.object({
  title: z.string(),
  explanation: z.string(),
  evidenceArticleIndices: z.array(z.number()),
});

/**
 * What the LLM synthesis step is allowed to return.
 *
 * confidence and reasoningType are intentionally absent — they are
 * pre-computed deterministically and injected after the LLM call.
 * The model writes prose only; it does not evaluate evidence quality.
 */
export const synthesisOutputSchema = z.object({
  summary: z.string(),
  drivers: z.array(driverSchema).min(1).max(3),
  caveats: z.array(z.string()),
});

/**
 * Full explanation shape (LLM output + pre-computed fields merged).
 * Matches StockExplanation from market.ts.
 */
export const explanationSchema = synthesisOutputSchema.extend({
  confidence: z.enum(["low", "medium", "high"]),
  reasoningType: z.enum([
    "company",
    "sector",
    "macro",
    "company_and_sector",
    "unclear",
  ]),
});

export type SynthesisOutput = z.infer<typeof synthesisOutputSchema>;
export type ExplanationResponse = z.infer<typeof explanationSchema>;
