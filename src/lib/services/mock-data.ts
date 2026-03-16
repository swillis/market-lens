import type {
  PriceSnapshot,
  CompanyProfile,
  NewsArticle,
  PeerContext,
} from "@/lib/types/market";

const MOCK_COMPANIES: Record<
  string,
  { name: string; sector: string; industry: string; exchange: string }
> = {
  NVDA: {
    name: "NVIDIA Corporation",
    sector: "Technology",
    industry: "Semiconductors",
    exchange: "NASDAQ",
  },
  TSLA: {
    name: "Tesla, Inc.",
    sector: "Consumer Cyclical",
    industry: "Auto Manufacturers",
    exchange: "NASDAQ",
  },
  AAPL: {
    name: "Apple Inc.",
    sector: "Technology",
    industry: "Consumer Electronics",
    exchange: "NASDAQ",
  },
  MSFT: {
    name: "Microsoft Corporation",
    sector: "Technology",
    industry: "Software - Infrastructure",
    exchange: "NASDAQ",
  },
  AMZN: {
    name: "Amazon.com, Inc.",
    sector: "Consumer Cyclical",
    industry: "Internet Retail",
    exchange: "NASDAQ",
  },
  GOOGL: {
    name: "Alphabet Inc.",
    sector: "Communication Services",
    industry: "Internet Content & Information",
    exchange: "NASDAQ",
  },
  META: {
    name: "Meta Platforms, Inc.",
    sector: "Communication Services",
    industry: "Internet Content & Information",
    exchange: "NASDAQ",
  },
};

const MOCK_PRICES: Record<string, { price: number; prevClose: number }> = {
  NVDA: { price: 142.5, prevClose: 138.2 },
  TSLA: { price: 248.3, prevClose: 255.1 },
  AAPL: { price: 198.7, prevClose: 196.9 },
  MSFT: { price: 425.6, prevClose: 422.3 },
  AMZN: { price: 189.2, prevClose: 186.8 },
  GOOGL: { price: 175.4, prevClose: 173.1 },
  META: { price: 512.8, prevClose: 508.5 },
};

function getMockNewsForSymbol(symbol: string): NewsArticle[] {
  const company = MOCK_COMPANIES[symbol];
  if (!company) return [];
  const now = new Date();

  const newsTemplates: Record<string, NewsArticle[]> = {
    NVDA: [
      {
        title:
          "NVIDIA sees continued AI chip demand from hyperscalers, analysts say",
        source: "Reuters",
        publishedAt: new Date(now.getTime() - 3600000 * 2).toISOString(),
        url: "https://example.com/nvda-ai-demand",
        summary:
          "Major cloud providers continue to ramp orders for NVIDIA's AI accelerators, supporting bullish sentiment.",
        relatedSymbols: ["NVDA"],
      },
      {
        title: "Semiconductor stocks rally on positive industry outlook",
        source: "Bloomberg",
        publishedAt: new Date(now.getTime() - 3600000 * 5).toISOString(),
        url: "https://example.com/semi-rally",
        summary:
          "Broad strength across chip stocks as industry forecasts point to continued growth.",
        relatedSymbols: ["NVDA", "AMD", "AVGO"],
      },
      {
        title:
          "AI infrastructure spending to exceed $200B in 2026, report finds",
        source: "CNBC",
        publishedAt: new Date(now.getTime() - 3600000 * 8).toISOString(),
        url: "https://example.com/ai-spending",
        summary:
          "New industry report projects massive increase in AI-related capital expenditure.",
        relatedSymbols: ["NVDA", "MSFT", "GOOGL"],
      },
      {
        title: "NVIDIA partners with major automaker on autonomous driving",
        source: "TechCrunch",
        publishedAt: new Date(now.getTime() - 3600000 * 14).toISOString(),
        url: "https://example.com/nvda-auto",
        summary:
          "New partnership expands NVIDIA's automotive AI platform footprint.",
        relatedSymbols: ["NVDA"],
      },
    ],
    TSLA: [
      {
        title:
          "Tesla deliveries fall short of estimates in latest quarter preview",
        source: "Reuters",
        publishedAt: new Date(now.getTime() - 3600000 * 3).toISOString(),
        url: "https://example.com/tsla-deliveries",
        summary:
          "Analysts lower delivery estimates ahead of upcoming quarterly report.",
        relatedSymbols: ["TSLA"],
      },
      {
        title: "EV market competition intensifies as Chinese rivals expand",
        source: "Financial Times",
        publishedAt: new Date(now.getTime() - 3600000 * 6).toISOString(),
        url: "https://example.com/ev-competition",
        summary:
          "Growing competition from BYD and others pressures Tesla's market share narrative.",
        relatedSymbols: ["TSLA"],
      },
      {
        title: "Auto sector broadly lower on tariff concerns",
        source: "Bloomberg",
        publishedAt: new Date(now.getTime() - 3600000 * 10).toISOString(),
        url: "https://example.com/auto-tariffs",
        summary:
          "Automotive stocks decline amid renewed trade policy uncertainty.",
        relatedSymbols: ["TSLA", "F", "GM"],
      },
    ],
  };

  return (
    newsTemplates[symbol] || [
      {
        title: `${company.name} trades in line with broader market`,
        source: "MarketWatch",
        publishedAt: new Date(now.getTime() - 3600000 * 4).toISOString(),
        url: "https://example.com/generic",
        summary: `${company.name} moves with broader ${company.sector} sector trends.`,
        relatedSymbols: [symbol],
      },
    ]
  );
}

const MOCK_PEERS: Record<string, string[]> = {
  NVDA: ["AMD", "AVGO", "INTC", "QCOM"],
  TSLA: ["F", "GM", "RIVN", "LCID"],
  AAPL: ["MSFT", "GOOGL", "SAMSUNG"],
  MSFT: ["AAPL", "GOOGL", "ORCL"],
  AMZN: ["WMT", "SHOP", "BABA"],
  GOOGL: ["META", "MSFT", "AMZN"],
  META: ["GOOGL", "SNAP", "PINS"],
};

export function getMockPrice(symbol: string): PriceSnapshot | null {
  const data = MOCK_PRICES[symbol.toUpperCase()];
  if (!data) return null;
  const change = +(data.price - data.prevClose).toFixed(2);
  const changePercent = +((change / data.prevClose) * 100).toFixed(2);
  return {
    symbol: symbol.toUpperCase(),
    currentPrice: data.price,
    previousClose: data.prevClose,
    change,
    changePercent,
    currency: "USD",
    asOf: new Date().toISOString(),
  };
}

export function getMockCompany(symbol: string): CompanyProfile | null {
  const data = MOCK_COMPANIES[symbol.toUpperCase()];
  if (!data) return null;
  return {
    symbol: symbol.toUpperCase(),
    companyName: data.name,
    sector: data.sector,
    industry: data.industry,
    exchange: data.exchange,
  };
}

export function getMockNews(symbol: string): NewsArticle[] {
  return getMockNewsForSymbol(symbol.toUpperCase());
}

export function getMockPeers(symbol: string): PeerContext {
  const peerSymbols = MOCK_PEERS[symbol.toUpperCase()] || [];
  return {
    peers: peerSymbols.map((s) => ({
      symbol: s,
      changePercent: +(Math.random() * 6 - 2).toFixed(2),
    })),
    sectorSummary:
      peerSymbols.length > 0
        ? "Peers are showing mixed movement, suggesting a combination of company-specific and sector-wide factors."
        : undefined,
  };
}
