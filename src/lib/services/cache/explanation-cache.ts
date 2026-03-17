/**
 * In-memory explanation cache — shared across all requests to the same server
 * instance, keyed by symbol.
 *
 * Cache hit conditions (ALL must be true):
 *   1. A cached entry exists for the symbol
 *   2. The stored fingerprint matches the current input fingerprint
 *   3. The entry is within the TTL window
 *
 * This means:
 *   - New articles     → new fingerprint → cache miss → pipeline runs
 *   - Price bucket shift → new fingerprint → cache miss → pipeline runs
 *   - Same inputs, multiple users → cache hit → zero LLM calls
 *
 * Storage upgrade path:
 *   Replace the Map with calls to Vercel KV / Redis / Upstash.
 *   The public API (get / set / invalidate) is unchanged.
 */

import type { ExplanationResult } from "@/lib/types/analysis";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Cache entries older than this are stale regardless of fingerprint match. */
const TTL_MS = 15 * 60 * 1000; // 15 minutes

const IS_DEV = process.env.NODE_ENV === "development";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type CacheEntry = {
  explanation: ExplanationResult;
  fingerprint: string;
  cachedAt: number; // Date.now()
};

/** symbol (uppercase) → cache entry */
const cache = new Map<string, CacheEntry>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStale(entry: CacheEntry): boolean {
  return Date.now() - entry.cachedAt > TTL_MS;
}

function log(msg: string): void {
  if (IS_DEV) console.log(`[explanation-cache] ${msg}`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the cached explanation for a symbol if:
 *   - it exists
 *   - the fingerprint matches the caller's current input fingerprint
 *   - it is within the TTL window
 *
 * Returns null on any miss so the caller knows to run the pipeline.
 */
export function getLatestExplanation(
  symbol: string,
  currentFingerprint: string
): ExplanationResult | null {
  const key = symbol.toUpperCase();
  const entry = cache.get(key);

  if (!entry) {
    log(`MISS ${key} — no cache entry`);
    return null;
  }

  if (isStale(entry)) {
    cache.delete(key);
    log(`MISS ${key} — entry expired (age=${Math.round((Date.now() - entry.cachedAt) / 1000)}s)`);
    return null;
  }

  if (entry.fingerprint !== currentFingerprint) {
    log(`MISS ${key} — fingerprint changed (${entry.fingerprint} → ${currentFingerprint})`);
    return null;
  }

  const ageS = Math.round((Date.now() - entry.cachedAt) / 1000);
  log(`HIT  ${key} — fingerprint=${currentFingerprint} age=${ageS}s`);
  return entry.explanation;
}

/**
 * Store or overwrite the cached explanation for a symbol.
 * Call this immediately after a successful pipeline run.
 */
export function setLatestExplanation(
  symbol: string,
  explanation: ExplanationResult,
  fingerprint: string
): void {
  const key = symbol.toUpperCase();
  cache.set(key, { explanation, fingerprint, cachedAt: Date.now() });
  log(`SET  ${key} fingerprint=${fingerprint}`);
}

/**
 * Remove the cached explanation for a symbol.
 * Use when you know the inputs have changed and want to force a fresh run
 * (e.g. after a webhook signals a new earnings release).
 */
export function invalidateExplanation(symbol: string): void {
  const key = symbol.toUpperCase();
  const deleted = cache.delete(key);
  if (deleted) log(`INVALIDATED ${key}`);
}

/**
 * Return all symbols currently held in cache (for observability).
 */
export function getCachedSymbols(): string[] {
  return [...cache.keys()];
}
