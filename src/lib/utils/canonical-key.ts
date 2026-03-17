/**
 * Normalises a driver title into a stable, human-readable identifier
 * suitable for grouping the same driver across multiple snapshots over time.
 *
 * Algorithm:
 *   1. Lowercase
 *   2. Strip punctuation / non-alphanumeric characters
 *   3. Remove common English stop words
 *   4. Take the first 4 significant words
 *   5. Join with underscores
 *
 * Examples:
 *   "Meta AI investment and restructuring" → "meta_ai_investment"
 *   "Federal Reserve rate hike concerns"   → "federal_reserve_rate_hike"
 *   "Sector-wide semiconductor selloff"    → "sector_wide_semiconductor_selloff"
 *   "Earnings beat guidance raise"         → "earnings_beat_guidance_raise"
 */

const STOP_WORDS = new Set([
  "a", "an", "the",
  "and", "or", "but", "nor",
  "in", "on", "at", "to", "for", "of", "by", "from", "with", "as",
  "is", "are", "was", "were", "be", "been", "being",
  "it", "its", "this", "that", "these", "those",
  "amid", "over", "into", "due", "amid", "amid",
]);

const MAX_WORDS = 4;

export function generateCanonicalKey(title: string): string {
  if (!title || title.trim().length === 0) return "unknown_driver";

  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")   // strip punctuation → spaces
    .split(/\s+/)                    // split on whitespace
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w))
    .slice(0, MAX_WORDS);

  return words.length > 0 ? words.join("_") : "unknown_driver";
}
