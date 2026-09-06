/**
 * One join for every provider's streamed body text.
 *
 * Providers send either a new token or a resent snapshot of the whole message
 * so far. This function is the only place that distinguishes the two, so a new
 * harness does not need its own merge logic.
 *
 * Tokens append. A longer chunk that already starts with the current text is a
 * snapshot and replaces. Overlap matching is never used: it ate blank lines,
 * headings, table rows, and doubled letters.
 */
export function joinStreamText(existing: string, incoming: string): string {
  if (!incoming) return existing;
  if (!existing) return incoming;
  if (incoming === existing) {
    // `\n` then `\n` is a Markdown paragraph break, not a snapshot of a
    // one-character message. Longer exact repeats are completed snapshots.
    return incoming.length <= 1 ? existing + incoming : existing;
  }
  if (incoming.length > existing.length && incoming.startsWith(existing)) {
    return incoming;
  }
  if (
    existing.length > incoming.length &&
    existing.startsWith(incoming) &&
    existing.slice(incoming.length).trim() === ""
  ) {
    return existing;
  }
  return existing + incoming;
}

/**
 * Join streamed reasoning the same way as body text, but break paragraphs when
 * a completed sentence is glued to the next thought with no whitespace
 * (`file.Extending` → `file.\n\nExtending`). Providers often emit discrete
 * thoughts as separate deltas without a separator.
 */
export function joinReasoningText(existing: string, incoming: string): string {
  if (!incoming) return existing;
  if (!existing) return incoming;
  if (incoming === existing) {
    return incoming.length <= 1 ? existing + incoming : existing;
  }
  if (incoming.length > existing.length && incoming.startsWith(existing)) {
    return incoming;
  }
  if (
    existing.length > incoming.length &&
    existing.startsWith(incoming) &&
    existing.slice(incoming.length).trim() === ""
  ) {
    return existing;
  }
  if (needsReasoningParagraphBreak(existing, incoming)) {
    return `${existing.replace(/\s+$/, "")}\n\n${incoming.replace(/^\s+/, "")}`;
  }
  return existing + incoming;
}

/** Insert paragraph breaks where sentence ends were glued to the next thought. */
export function formatReasoningProse(text: string): string {
  return text.replace(/([.!?])([A-Z])/g, "$1\n\n$2");
}

function needsReasoningParagraphBreak(
  existing: string,
  incoming: string,
): boolean {
  if (/\s$/.test(existing) || /^\s/.test(incoming)) return false;
  return /[.!?]["')\]]*$/.test(existing) && /^["“]?[A-Z]/.test(incoming);
}

/**
 * How much of a completed snapshot to emit after tokens already landed.
 *
 * Claude and Codex send the full message again when a turn (or item) finishes.
 * If that copy is the same as — or already contained in — what we streamed,
 * emit nothing. If it only adds a suffix, emit the suffix. If it is a new
 * stretch (text after a tool, no tokens yet), emit the whole snapshot.
 */
export function snapshotRemainder(already: string, snapshot: string): string {
  if (!snapshot) return "";
  if (!already) return snapshot;
  if (snapshot === already) return "";
  if (snapshot.startsWith(already)) return snapshot.slice(already.length);
  if (already.startsWith(snapshot)) return "";
  return snapshot;
}

/** Body text from a stream. Whitespace is real content, not a missing field. */
export function streamTextDelta(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** @deprecated Use joinStreamText. Kept so existing imports keep working. */
export const mergeStream = joinStreamText;
