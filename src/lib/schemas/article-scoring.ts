import { z } from "zod";

/**
 * Schema for one article's scoring output from the LLM.
 * The model returns an array of these, one per input article.
 */
export const articleScoreSchema = z.object({
  articleIndex: z.number().int().min(0),
  relevance: z.number().int().min(0).max(5),
  relationType: z.enum(["company", "sector", "macro", "unrelated"]),
  usefulness: z.enum(["direct_evidence", "supporting_context", "irrelevant"]),
  candidateDriver: z.string(),
  rationale: z.string(),
});

export const articleScoresSchema = z.array(articleScoreSchema);

export type ArticleScore = z.infer<typeof articleScoreSchema>;
export type ArticleScores = z.infer<typeof articleScoresSchema>;
