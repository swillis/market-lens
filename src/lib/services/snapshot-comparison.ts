/**
 * Snapshot comparison service.
 *
 * compareSnapshots()         — pure deterministic diff, no LLM
 * generateNarrativeSummary() — deterministic rule-based change description
 * compareAndNarrate()        — convenience wrapper for both steps
 *
 * No LLM is used here. The diff is described entirely in code, which is:
 *   - cheaper (no API call for every narrative change)
 *   - consistent (same diff → same description, always)
 *   - faster (synchronous)
 *
 * Upgrade path: if richer language is needed, re-introduce an LLM narrator
 * that receives the diff and returns a { summary } — the structure is already
 * designed to support that (see buildDiffPrompt and NARRATOR_SYSTEM_PROMPT
 * which are kept as comments below for reference).
 */

import type {
  NarrativeSnapshot,
  RetainedDriver,
  SnapshotDiff,
  NarrativeComparison,
} from "@/lib/types/analysis";

// ---------------------------------------------------------------------------
// Thresholds — what counts as a "meaningful" change worth narrating
// ---------------------------------------------------------------------------

const CONFIDENCE_CHANGE_THRESHOLD = 0.10;
const STRENGTH_CHANGE_THRESHOLD   = 0.10;

// ---------------------------------------------------------------------------
// Pure diff — no LLM
// ---------------------------------------------------------------------------

/**
 * Diff two snapshots using canonicalKey as the stable driver identifier.
 *
 * Matching is by canonicalKey only — driver titles may be rephrased by the
 * LLM between runs but the same underlying event will share a canonicalKey.
 */
export function compareSnapshots(
  previous: NarrativeSnapshot,
  current: NarrativeSnapshot
): SnapshotDiff {
  const previousKeys = new Map(previous.drivers.map((d) => [d.canonicalKey, d]));
  const currentKeys  = new Map(current.drivers.map((d) => [d.canonicalKey, d]));

  // Drivers in current but not in previous
  const addedDrivers = current.drivers.filter(
    (d) => !previousKeys.has(d.canonicalKey)
  );

  // Drivers in previous but not in current
  const removedDrivers = previous.drivers.filter(
    (d) => !currentKeys.has(d.canonicalKey)
  );

  // Drivers in both — compute strength delta
  const retainedDrivers: RetainedDriver[] = [];
  for (const [key, curr] of currentKeys) {
    const prev = previousKeys.get(key);
    if (!prev) continue;
    retainedDrivers.push({
      canonicalKey: key,
      title: curr.title,
      previousTitle: prev.title,
      driverType: curr.driverType,
      inferenceLevel: curr.inferenceLevel,
      previousStrength: prev.strength,
      currentStrength: curr.strength,
      strengthDelta: curr.strength - prev.strength,
    });
  }

  const confidenceDelta =
    current.confidenceScore - previous.confidenceScore;

  const reasoningTypeChanged =
    previous.reasoningType !== current.reasoningType;

  const significantStrengthShift = retainedDrivers.some(
    (d) => Math.abs(d.strengthDelta) > STRENGTH_CHANGE_THRESHOLD
  );

  const hasChanges =
    addedDrivers.length > 0 ||
    removedDrivers.length > 0 ||
    Math.abs(confidenceDelta) > CONFIDENCE_CHANGE_THRESHOLD ||
    reasoningTypeChanged ||
    significantStrengthShift;

  return {
    symbol: current.symbol,
    previousSnapshot: previous,
    currentSnapshot: current,
    addedDrivers,
    removedDrivers,
    retainedDrivers,
    confidenceDelta,
    reasoningTypeChanged,
    hasChanges,
  };
}

// ---------------------------------------------------------------------------
// Deterministic narrator — no LLM
// ---------------------------------------------------------------------------

/**
 * Generate a short, human-readable description of what changed between two
 * snapshots. Entirely deterministic — no LLM call.
 *
 * Priority order (most informative change wins the headline):
 *   1. Added drivers (new narrative emerging)
 *   2. Removed drivers (earlier narrative fading)
 *   3. Reasoning type shift (company → sector, etc.)
 *   4. Confidence change only
 *
 * Returns null when hasChanges is false.
 */
export function generateNarrativeSummary(diff: SnapshotDiff): string | null {
  if (!diff.hasChanges) return null;

  const parts: string[] = [];

  if (diff.addedDrivers.length > 0) {
    const titles = diff.addedDrivers.map((d) => `"${d.title}"`).join(" and ");
    parts.push(
      `${titles} ${diff.addedDrivers.length === 1 ? "is" : "are"} now emerging as ${
        diff.addedDrivers.length === 1 ? "a driver" : "drivers"
      }`
    );
  }

  if (diff.removedDrivers.length > 0) {
    const titles = diff.removedDrivers.map((d) => `"${d.title}"`).join(" and ");
    parts.push(`the earlier ${titles} narrative appears to have faded`);
  }

  if (diff.reasoningTypeChanged) {
    const fromLabel = diff.previousSnapshot.reasoningType.replace(/_/g, "/");
    const toLabel = diff.currentSnapshot.reasoningType.replace(/_/g, "/");
    parts.push(`the narrative has shifted from ${fromLabel} to ${toLabel} drivers`);
  }

  // Confidence-only change (nothing structural changed)
  if (parts.length === 0 && Math.abs(diff.confidenceDelta) > CONFIDENCE_CHANGE_THRESHOLD) {
    parts.push(
      diff.confidenceDelta > 0
        ? "supporting evidence has strengthened since the previous analysis"
        : "supporting evidence has weakened since the previous analysis"
    );
  }

  return parts.length > 0
    ? capitalise(parts.join("; ")) + "."
    : "The narrative has shifted since the previous analysis.";
}

function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ---------------------------------------------------------------------------
// Convenience wrapper
// ---------------------------------------------------------------------------

/**
 * Diff two snapshots and generate a narrative change summary in one call.
 * Fully synchronous — no LLM involved.
 */
export function compareAndNarrate(
  previous: NarrativeSnapshot,
  current: NarrativeSnapshot
): NarrativeComparison {
  const diff = compareSnapshots(previous, current);
  const narrativeSummary = generateNarrativeSummary(diff);
  return { diff, narrativeSummary };
}
