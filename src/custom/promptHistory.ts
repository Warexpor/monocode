const HISTORY_KEY = "monocode.promptHistory";
const MAX_ENTRIES = 50;
const MAX_CHARS = 8_000;

function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.slice(0, MAX_CHARS))
      .filter((entry) => entry.trim().length > 0)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function writeHistory(entries: string[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // private mode / quota
  }
}

/** Newest-first list of recent sends. */
export function loadPromptHistory(): string[] {
  return readHistory();
}

/** Push a sent prompt to history (dedupes consecutive duplicates). */
export function pushPromptHistory(text: string): void {
  const trimmed = text.trim().slice(0, MAX_CHARS);
  if (!trimmed) return;
  const prev = readHistory();
  if (prev[0] === trimmed) return;
  writeHistory([trimmed, ...prev.filter((entry) => entry !== trimmed)]);
}

/**
 * Navigate history like a shell: ↑ older, ↓ newer.
 * `index` is -1 for "live draft"; returns the next index + text.
 */
export function stepPromptHistory(
  history: string[],
  index: number,
  direction: "older" | "newer",
  liveDraft: string,
): { index: number; text: string } {
  if (history.length === 0) return { index: -1, text: liveDraft };
  if (direction === "older") {
    const next = Math.min(index + 1, history.length - 1);
    if (index < 0) {
      return { index: 0, text: history[0]! };
    }
    return { index: next, text: history[next]! };
  }
  if (index <= 0) return { index: -1, text: liveDraft };
  const next = index - 1;
  return { index: next, text: history[next]! };
}

export function resetPromptHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}
