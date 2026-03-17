import { z } from "zod";

/**
 * Schema for a single driver as returned by the LLM consolidation step.
 *
 * NOTE: `strength` is NOT included here — it is computed deterministically
 * from the referenced article scores after the LLM call returns, so the
 * model cannot self-report confidence.
 */
export const llmDriverSchema = z.object({
  title: z.string().min(1),
  driverType: z.enum(["company", "sector", "macro"]),
  evidenceArticleIndices: z.array(z.number().int().min(0)),
  inferenceLevel: z.enum(["direct", "supporting"]),
  explanation: z.string().min(1),
});

export const llmConsolidationSchema = z.object({
  drivers: z.array(llmDriverSchema).max(3),
  reasoningType: z.enum([
    "company",
    "sector",
    "macro",
    "company_and_sector",
    "unclear",
  ]),
});

export type LLMDriver = z.infer<typeof llmDriverSchema>;
export type LLMConsolidation = z.infer<typeof llmConsolidationSchema>;
