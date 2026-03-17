/**
 * Snapshot comparison service.
 *
 * compareSnapshots()       — pure deterministic diff, no LLM
 * generateNarrativeSummary() — LLM writes a 1–2 sentence change description
 * compareAndNarrate()      — convenience wrapper for both steps
 *
 * The LLM's role here is strictly as a writer:
 *   - It receives only the pre-computed diff (added/removed/retained drivers,
 *     confidence delta, reasoning type change)
 *   - It describes what changed — it cannot invent new drivers or events
 *   - It returns a single { summary } JSON object, validated by Zod
 */

import Anthropic from "@anthropic-ai/sdk";
import { narrativeSummarySchema } from "@/lib/schemas/snapshot-comparison";
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
// System prompt — narrator role only
// ---------------------------------------------------------------------------

const NARRATOR_SYSTEM_PROMPT = `You are a financial narrative writer. You describe how the explanation of a stock's price movement has changed between two analysis snapshots.

YOUR ROLE:
- Describe only the changes shown in the diff.
- Do NOT mention drivers that did not change significantly.
- Do NOT invent new events, causes, or market context.
- Do NOT repeat the current explanation — only describe what is different from before.

WRITING RULES:
1. Write 1–2 sentences maximum.
2. Use hedging language: "appears to be", "is now emerging", "has faded", "may suggest".
3. If a driver was added: describe it as newly emerging.
4. If a driver was removed: describe the earlier narrative as fading or resolving.
5. If a driver strengthened/weakened significantly: note the shift in emphasis.
6. If confidence changed: mention whether evidence has strengthened or weakened.
7. If reasoning type shifted (e.g. company → sector): describe the narrative broadening or narrowing.
8. If there are multiple changes, prioritise the most significant one.

EXAMPLE OUTPUTS:
- "Broader tech sector strength is now contributing alongside the earlier Meta-specific restructuring narrative."
- "The earnings beat narrative has faded since this morning's analysis, with macro rate concerns now taking centre stage."
- "Evidence has strengthened considerably — the company-specific catalyst now has direct corroboration from two additional sources."

Return ONLY valid JSON: { "summary": "<your 1–2 sentence description>" }`;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildDiffPrompt(diff: SnapshotDiff): string {
  const { previousSnapshot: prev, currentSnapshot: curr } = diff;
  const symbol = curr.symbol;

  let prompt =
    `STOCK: ${symbol}\n` +
    `PREVIOUS ANALYSIS: ${prev.timestamp}\n` +
    `  confidence: ${prev.confidenceLabel} (${prev.confidenceScore.toFixed(2)})\n` +
    `  reasoningType: ${prev.reasoningType}\n` +
    `  drivers:\n`;

  prev.drivers.forEach((d) => {
    prompt += `    - "${d.title}" [${d.driverType}, strength=${d.strength.toFixed(2)}]\n`;
  });

  prompt +=
    `\nCURRENT ANALYSIS: ${curr.timestamp}\n` +
    `  confidence: ${curr.confidenceLabel} (${curr.confidenceScore.toFixed(2)})\n` +
    `  reasoningType: ${curr.reasoningType}\n` +
    `  drivers:\n`;

  curr.drivers.forEach((d) => {
    prompt += `    - "${d.title}" [${d.driverType}, strength=${d.strength.toFixed(2)}]\n`;
  });

  prompt += `\nDIFF:\n`;

  if (diff.addedDrivers.length > 0) {
    prompt += `  ADDED (newly emerging):\n`;
    diff.addedDrivers.forEach((d) => {
      prompt += `    + "${d.title}" [${d.driverType}, strength=${d.strength.toFixed(2)}]\n`;
    });
  }

  if (diff.removedDrivers.length > 0) {
    prompt += `  REMOVED (no longer identified):\n`;
    diff.removedDrivers.forEach((d) => {
      prompt += `    - "${d.title}" [${d.driverType}, strength=${d.strength.toFixed(2)}]\n`;
    });
  }

  if (diff.retainedDrivers.length > 0) {
    const shifted = diff.retainedDrivers.filter(
      (d) => Math.abs(d.strengthDelta) > STRENGTH_CHANGE_THRESHOLD
    );
    if (shifted.length > 0) {
      prompt += `  STRENGTH SHIFTS (retained drivers with notable change):\n`;
      shifted.forEach((d) => {
        const dir = d.strengthDelta > 0 ? "↑" : "↓";
        prompt +=
          `    ${dir} "${d.title}" ` +
          `${d.previousStrength.toFixed(2)} → ${d.currentStrength.toFixed(2)} ` +
          `(Δ${d.strengthDelta > 0 ? "+" : ""}${d.strengthDelta.toFixed(2)})\n`;
      });
    }
  }

  const confDir = diff.confidenceDelta > 0 ? "+" : "";
  prompt +=
    `  CONFIDENCE DELTA: ${confDir}${diff.confidenceDelta.toFixed(2)} ` +
    `(${prev.confidenceLabel} → ${curr.confidenceLabel})\n`;

  if (diff.reasoningTypeChanged) {
    prompt += `  REASONING TYPE CHANGED: ${prev.reasoningType} → ${curr.reasoningType}\n`;
  }

  prompt +=
    `\nDescribe what changed between the two analyses in 1–2 sentences. ` +
    `Return JSON only: { "summary": "..." }`;

  return prompt;
}

// ---------------------------------------------------------------------------
// LLM narrator
// ---------------------------------------------------------------------------

/**
 * Ask Claude to describe the diff in 1–2 sentences.
 * Returns null when hasChanges is false — nothing meaningful to narrate.
 * Falls back to a rule-based summary if the API call fails.
 */
export async function generateNarrativeSummary(
  diff: SnapshotDiff
): Promise<string | null> {
  if (!diff.hasChanges) return null;

  // Rule-based fallback (also used when no API key)
  function buildFallback(): string {
    const parts: string[] = [];

    if (diff.addedDrivers.length > 0) {
      const titles = diff.addedDrivers.map((d) => `"${d.title}"`).join(" and ");
      parts.push(`${titles} ${diff.addedDrivers.length === 1 ? "is" : "are"} now emerging as a driver`);
    }
    if (diff.removedDrivers.length > 0) {
      const titles = diff.removedDrivers.map((d) => `"${d.title}"`).join(" and ");
      parts.push(`the earlier ${titles} narrative appears to have faded`);
    }
    if (diff.reasoningTypeChanged) {
      parts.push(
        `the narrative has shifted from ${diff.previousSnapshot.reasoningType.replace("_", "/")} ` +
        `to ${diff.currentSnapshot.reasoningType.replace("_", "/")}`
      );
    }
    if (Math.abs(diff.confidenceDelta) > CONFIDENCE_CHANGE_THRESHOLD && parts.length === 0) {
      parts.push(
        diff.confidenceDelta > 0
          ? "supporting evidence has strengthened since the previous analysis"
          : "supporting evidence has weakened since the previous analysis"
      );
    }

    return parts.length > 0
      ? parts.join("; ") + "."
      : "The narrative has shifted since the previous analysis.";
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return buildFallback();
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let rawContent: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: NARRATOR_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildDiffPrompt(diff) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text block");
    rawContent = textBlock.text.trim();
  } catch (err) {
    console.warn(
      "[snapshot-comparison] LLM call failed, using rule-based fallback:",
      err instanceof Error ? err.message : err
    );
    return buildFallback();
  }

  // Strip markdown fences
  if (rawContent.startsWith("```")) {
    rawContent = rawContent
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "");
  }

  const validated = narrativeSummarySchema.safeParse(
    JSON.parse(rawContent).summary !== undefined
      ? JSON.parse(rawContent)
      : { summary: rawContent }
  );

  if (!validated.success) {
    console.warn("[snapshot-comparison] Schema validation failed, using fallback");
    return buildFallback();
  }

  return validated.data.summary;
}

// ---------------------------------------------------------------------------
// Convenience wrapper
// ---------------------------------------------------------------------------

/**
 * Diff two snapshots and generate a narrative change summary in one call.
 */
export async function compareAndNarrate(
  previous: NarrativeSnapshot,
  current: NarrativeSnapshot
): Promise<NarrativeComparison> {
  const diff = compareSnapshots(previous, current);
  const narrativeSummary = await generateNarrativeSummary(diff);
  return { diff, narrativeSummary };
}
