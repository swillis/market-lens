/**
 * Backward-compatible adapter for the explanation pipeline.
 *
 * The API route and any other callers continue to use:
 *   generateExplanation(price, company, news, peers) → StockExplanation
 *
 * Internally this delegates to runExplanationPipeline() and strips the
 * pipeline metadata before returning, so the public interface is unchanged.
 *
 * To access the full ExplanationResult (including pipelineMetadata), call
 * runExplanationPipeline() from /lib/services/explanation directly.
 */
import { runExplanationPipeline } from "@/lib/services/explanation";
import type {
  PriceSnapshot,
  CompanyProfile,
  NewsArticle,
  PeerContext,
  StockExplanation,
} from "@/lib/types/market";

export async function generateExplanation(
  price: PriceSnapshot,
  company: CompanyProfile,
  news: NewsArticle[],
  peers: PeerContext
): Promise<StockExplanation> {
  const { pipelineMetadata: _, ...explanation } = await runExplanationPipeline({
    price,
    company,
    articles: news,
    peers,
  });
  return explanation;
}
