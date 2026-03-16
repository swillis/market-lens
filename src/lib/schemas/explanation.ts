import { z } from "zod";

export const driverSchema = z.object({
  title: z.string(),
  explanation: z.string(),
  evidenceArticleIndices: z.array(z.number()),
});

export const explanationSchema = z.object({
  summary: z.string(),
  drivers: z.array(driverSchema).min(1).max(5),
  confidence: z.enum(["low", "medium", "high"]),
  reasoningType: z.enum([
    "company",
    "sector",
    "macro",
    "company_and_sector",
    "unclear",
  ]),
  caveats: z.array(z.string()),
});

export type ExplanationResponse = z.infer<typeof explanationSchema>;
