const DRAFT_KEY = "monocode.composerDrafts";
const MAX_DRAFTS = 80;
const MAX_CHARS = 50_000;

type DraftMap = Record<string, string>;

function readMap(): DraftMap {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: DraftMap = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) out[id] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: DraftMap): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(map));
  } catch {
    // private mode / quota
  }
}

/** Restore a half-written composer for this session, if any. */
export function loadComposerDraft(sessionId: string): string {
  if (!sessionId) return "";
  return readMap()[sessionId] ?? "";
}

/** Persist or clear the composer draft for a session. */
export function saveComposerDraft(sessionId: string, text: string): void {
  if (!sessionId) return;
  const map = readMap();
  const trimmed = text.slice(0, MAX_CHARS);
  if (!trimmed.trim()) {
    if (!(sessionId in map)) return;
    delete map[sessionId];
    writeMap(map);
    return;
  }
  map[sessionId] = trimmed;
  const ids = Object.keys(map);
  if (ids.length > MAX_DRAFTS) {
    for (const id of ids.slice(0, ids.length - MAX_DRAFTS)) {
      delete map[id];
    }
  }
  writeMap(map);
}

export function clearComposerDraft(sessionId: string): void {
  saveComposerDraft(sessionId, "");
}

/** Test helper. */
export function resetComposerDrafts(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
