export type PriceSnapshot = {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  currency?: string;
  asOf: string;
};

export type CompanyProfile = {
  symbol: string;
  companyName: string;
  sector?: string;
  industry?: string;
  exchange?: string;
};

export type NewsArticle = {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  summary?: string;
  relatedSymbols?: string[];
};

export type PeerContext = {
  peers: Array<{
    symbol: string;
    changePercent?: number;
  }>;
  sectorSummary?: string;
};

export type StockExplanation = {
  summary: string;
  drivers: Array<{
    title: string;
    explanation: string;
    evidenceArticleIndices: number[];
  }>;
  confidence: "low" | "medium" | "high";
  reasoningType:
    | "company"
    | "sector"
    | "macro"
    | "company_and_sector"
    | "unclear";
  caveats: string[];
};

export type TickerResult = {
  price: PriceSnapshot;
  company: CompanyProfile;
  news: NewsArticle[];
  peers: PeerContext;
  explanation: StockExplanation;
  generatedAt: string;
  warnings?: string[];
};

export type ApiErrorResponse = {
  error: string;
  code: string;
  retryable: boolean;
};
