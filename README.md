# Market Lens

AI-powered stock move explainer. Type a ticker and understand why it's moving today.

## Quick Start

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

By default the app runs in **mock mode** (`USE_MOCK_DATA=true`) — no API keys needed.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `USE_MOCK_DATA` | No | Set `true` for local dev without API keys |
| `ANTHROPIC_API_KEY` | For live AI | [Anthropic](https://console.anthropic.com) API key (uses claude-sonnet-4-20250514) |
| `FMP_API_KEY` | For live prices | [Financial Modeling Prep](https://financialmodelingprep.com) API key (free: 250 req/day) |
| `FINNHUB_API_KEY` | For live news | [Finnhub](https://finnhub.io) API key (free: 60 req/min) |

## Architecture

```
src/
├── app/
│   ├── page.tsx                    # Homepage with ticker search
│   ├── ticker/[symbol]/page.tsx    # Result page
│   └── api/explain/route.ts        # Orchestration endpoint
├── components/                     # UI components
│   ├── ticker-search.tsx
│   ├── price-card.tsx
│   ├── explanation-card.tsx
│   ├── drivers-card.tsx
│   ├── news-list.tsx
│   ├── loading-skeleton.tsx
│   └── error-state.tsx
└── lib/
    ├── services/                   # Data providers (swappable)
    │   ├── market-data.ts          # Price data (FMP)
    │   ├── company-profile.ts      # Company info (FMP)
    │   ├── news.ts                 # News articles (Finnhub)
    │   ├── peers.ts                # Peer context (Finnhub + FMP)
    │   ├── explain.ts              # AI explanation (Anthropic Claude)
    │   └── mock-data.ts            # Mock fallback
    ├── errors.ts                   # Structured error types
    ├── fetch-with-timeout.ts       # Fetch wrapper with timeouts
    ├── schemas/
    │   ├── explanation.ts          # Zod validation for AI output
    │   └── api-responses.ts        # Zod validation for external APIs
    ├── types/
    │   └── market.ts               # Core TypeScript types
    └── utils/
        ├── cn.ts                   # Tailwind class merge
        ├── format.ts               # Price/percent formatting
        └── dates.ts                # Time formatting
```

### Flow

1. User enters ticker → navigates to `/ticker/NVDA`
2. Client fetches `/api/explain?symbol=NVDA`
3. API route fetches price, company, news, and peer data in parallel
4. All data is passed to the AI explanation service
5. AI returns structured JSON validated by Zod
6. Client renders the result with price, summary, drivers, and news cards

### Data Providers

Services are abstracted behind simple modules. To swap a provider, edit the relevant file in `src/lib/services/`. Each service falls back to mock data when API keys are missing.

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Anthropic Claude API (claude-sonnet-4-20250514)
- Financial Modeling Prep (prices, profiles)
- Finnhub (news, peers)
- Zod (response validation)

## Future Improvements

- Market overview page with notable movers
- Pre-market / after-hours summary
- Unusual volume detection
- Narrative detection across multiple tickers
- Saved tickers / watchlist
- Email briefings
- Streaming AI responses
