# Market Lens — Claude Context

**What it is:** An AI-powered stock move explainer. Users type a ticker and get a structured, evidence-grounded explanation of why that stock is moving today, backed by real-time news and a narrative timeline.

**Repo:** github.com/swillis/market-lens
**Deploys:** Vercel, auto-deploys on push to `main`

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind v4, Lucide icons |
| Validation | Zod |
| LLM | `@anthropic-ai/sdk` — `claude-haiku-4-5-20251001` |
| Market data | Financial Modeling Prep (FMP) |
| News | Finnhub |

---

## Running Locally

```bash
npm run dev          # → localhost:3000
```

The `.claude/launch.json` is already configured (server name: `market-lens`) — use the preview tool directly.

**Required env vars** (copy `.env.local.example` → `.env.local`):

```
ANTHROPIC_API_KEY=   # required for LLM calls
FMP_API_KEY=         # prices + company profiles (free: 250 req/day)
FINNHUB_API_KEY=     # news (free: 60 req/min, degrades gracefully if missing)
USE_MOCK_DATA=true   # set false to use real APIs
```

`USE_MOCK_DATA=true` bypasses all external APIs — useful for UI work without burning API credits.

---

## Architecture — Full Data Flow

```
GET /api/explain?symbol=COIN
  ├─ fetchPriceSnapshot()     ─┐ required, parallel
  ├─ fetchCompanyProfile()    ─┘
  ├─ fetchNews()              ─┐ optional (Promise.allSettled — graceful degradation)
  └─ fetchPeerContext()       ─┘
        ↓
  runExplanationPipeline(input)
    1. computeFingerprint()       deterministic: djb2(symbol + 0.5% price bucket + top-10 article URLs)
    2. getLatestExplanation()     cache check: fingerprint match + <15min TTL → return, 0 LLM calls
    3. scoreArticles()            LLM #1 — relevance judge (scores 0-5, assigns candidateDriver per article)
    4. consolidateDrivers()       DETERMINISTIC — groups articles by candidateDriver label from step 3
    5. calculateConfidence()      DETERMINISTIC — weighted score → "low" | "medium" | "high"
    6. synthesize()               LLM #2 — prose writer only (receives pre-computed drivers + confidence)
    7. setLatestExplanation()     cache the result
    8. maybeStoreSnapshot()       fire-and-forget — only stores if compareSnapshots().hasChanges === true

GET /api/timeline/[symbol]   → returns stored NarrativeSnapshots, newest first
GET /api/tickers/search      → autocomplete (FMP search, falls back to static common-tickers list)
```

**LLM call budget per request:**
- Cache hit → **0 LLM calls**
- Cache miss → **2 LLM calls** (score + synthesize)
- Snapshot diff + narrative → **0** (fully deterministic)

---

## Critical Design Rules

These decisions were made deliberately — don't change them without understanding why:

### LLM roles are strictly separated
- **Scorer** (`scoreArticles`): judges relevance only, never explains the move
- **Writer** (`synthesize`): writes prose only, receives pre-computed drivers, never determines confidence
- **Confidence**: always computed in code (`calculateConfidence`), never self-reported by LLM
- **reasoningType**: always derived from driver types in code, never LLM-reported

### Consolidation is deterministic (no 3rd LLM call)
The scorer already assigns a `candidateDriver` label to every article. `consolidateDrivers()` groups articles by that label — no second LLM clustering call needed.

### Snapshots only store on meaningful change
`maybeStoreSnapshot()` runs `compareSnapshots()` deterministically and skips storage if `hasChanges === false`. The change thresholds:
- Any added or removed driver → change
- Confidence delta > 0.10 → change
- reasoningType shift → change
- Retained driver strength delta > 0.10 → change

### Fingerprinting prevents redundant pipeline runs
Price is bucketed to ±0.5% bands (`+2.7%` → `+2.5`) so tick noise doesn't invalidate cache. New articles → new fingerprint → cache miss → fresh pipeline run.

---

## Key File Map

```
src/lib/services/explanation/
  index.ts                — pipeline orchestrator ← read this first
  article-scoring.ts      — LLM #1 (relevance judge, Zod-validated output)
  driver-consolidation.ts — deterministic grouping by candidateDriver label
  confidence.ts           — deterministic confidence scoring
  synthesis.ts            — LLM #2 (prose writer, Zod-validated output)
  fingerprint.ts          — computeFingerprint() + shouldGenerateNewSnapshot()

src/lib/services/cache/
  explanation-cache.ts    — in-memory cache, keyed by symbol (swap for Redis later)

src/lib/services/
  snapshot-store.ts       — NarrativeSnapshot persistence (dev: .data/snapshots.json)
  snapshot-comparison.ts  — deterministic diff + rule-based narrative summary

src/lib/types/
  analysis.ts             — all pipeline types (ScoredArticle, CandidateDriver, NarrativeSnapshot…)
  market.ts               — domain types (PriceSnapshot, StockExplanation, TickerResult…)

src/lib/utils/
  canonical-key.ts        — driver title → stable identifier
  market-hours.ts         — getMarketStatus() → open | pre_market | after_hours | closed

src/app/api/
  explain/route.ts           — main endpoint (rate limiting: 10 req/60s per IP)
  timeline/[symbol]/route.ts — snapshot retrieval
  tickers/search/route.ts    — autocomplete

src/components/
  timeline-card.tsx       — narrative timeline UI with MarketStatusCallout
  drivers-card.tsx        — shows drivers with inline supporting evidence
  news-list.tsx           — "Top Evidence" with expand-to-show-all
  price-card.tsx
  explanation-card.tsx
  ticker-search.tsx       — autocomplete dropdown with debounce
```

---

## Naming Conventions

**`canonicalKey`** — stable driver identifier across snapshots, generated by `generateCanonicalKey()` in `src/lib/utils/canonical-key.ts`:
- Lowercase, punctuation stripped, stop words removed, first 4 meaningful words, `_` joined
- `"Meta AI investment and restructuring"` → `"meta_ai_investment"`

**`sourceFingerprint`** — djb2 hex string stored in `NarrativeSnapshot`. Survives server restarts (persisted to disk in dev). Used to gate new snapshot creation.

**`strength`** (0–1) — computed deterministically from article `relevance` scores:
- `base` = avg relevance / 5
- `countBonus` = min(0.2, 0.07 × (articles − 1))
- `directBonus` = +0.10 if any article is `direct_evidence`
- Never LLM-reported

**`inferenceLevel`** — `"direct"` if any supporting article is company-specific, else `"supporting"`

---

## Dev-Only Behaviours

| Behaviour | How |
|---|---|
| Verbose pipeline logging | `NODE_ENV=development` → `[pipeline]`, `[explanation-cache]`, `[article-scoring]`, `[driver-consolidation]` logs |
| Snapshot disk persistence | `.data/snapshots.json` (max 100 per symbol, newest first) |
| Skip all external calls | `USE_MOCK_DATA=true` in `.env.local` |

In **production (Vercel)** the snapshot store is ephemeral in-memory per cold start — snapshots don't survive redeploys.

---

## Schemas (Zod)

Every LLM response is parsed through a Zod schema before being used:

| Schema file | Validates |
|---|---|
| `schemas/article-scoring.ts` | `scoreArticles()` LLM output |
| `schemas/explanation.ts` | `synthesisOutputSchema` (no confidence/reasoningType — those are injected after) |
| `schemas/snapshot-comparison.ts` | snapshot diff narrative |
| `schemas/api-responses.ts` | FMP + Finnhub API responses |

---

## Known Backlog / Not Yet Done

- **Persistent snapshot storage in prod** — currently ephemeral. Next step: Vercel KV or Upstash Redis. The `snapshot-store.ts` interface (`storeSnapshot` / `getSnapshots`) is already abstracted — just swap the implementation.
- **Cross-instance cache sharing** — `explanation-cache.ts` is in-memory per instance. Same upgrade path: Redis.
- **US market holiday awareness** — `market-hours.ts` uses weekday/time only, doesn't know about NYSE holidays.
- **Timeline on first prod load** — timeline is empty until the user triggers their first explain request (no seeded data in prod).
- **Ticker search quality** — FMP `/stock/search` fallback to static list when API 403s. A more comprehensive static list or different data provider would help.

---

## Deployment Checklist (Vercel)

1. Push to `main` — Vercel auto-deploys
2. Required env vars in Vercel dashboard → Settings → Environment Variables:
   - `ANTHROPIC_API_KEY`
   - `FMP_API_KEY`
   - `FINNHUB_API_KEY`
   - `USE_MOCK_DATA=false`
3. No build configuration needed — uses Next.js defaults
