import { z } from "zod";

/**
 * The only thing we ask the LLM to return in the comparison step —
 * a single narrative change summary sentence.
 *
 * Keeping it minimal ensures the model cannot smuggle confidence values,
 * driver inventions, or other unverified claims into the output.
 */
export const narrativeSummarySchema = z.object({
  summary: z.string().min(10).max(500),
});

export type NarrativeSummaryOutput = z.infer<typeof narrativeSummarySchema>;
