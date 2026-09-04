import type { MessageQueueStatus, QueuedMessage } from "../lib/session";

const KEY = "monocode.queuedMessages";
const MAX_SESSIONS = 40;

export type PersistedQueue = {
  messages: QueuedMessage[];
  status?: MessageQueueStatus;
};

type QueueMap = Record<string, PersistedQueue>;

function readMap(): QueueMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: QueueMap = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const rec = value as Record<string, unknown>;
      if (!Array.isArray(rec.messages)) continue;
      const messages: QueuedMessage[] = [];
      for (const item of rec.messages) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        if (typeof row.id !== "string" || typeof row.text !== "string") continue;
        messages.push({
          id: row.id,
          text: row.text,
          attachments: Array.isArray(row.attachments) ? [] : [],
          intent:
            row.intent === "plan" || row.intent === "build"
              ? row.intent
              : "default",
        });
      }
      if (messages.length === 0) continue;
      const status =
        rec.status === "paused" ||
        rec.status === "active" ||
        rec.status === "resuming"
          ? rec.status
          : "active";
      out[id] = { messages, status };
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: QueueMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function loadPersistedQueue(sessionId: string): PersistedQueue | undefined {
  if (!sessionId) return undefined;
  return readMap()[sessionId];
}

export function savePersistedQueue(
  sessionId: string,
  messages: QueuedMessage[] | undefined,
  status?: MessageQueueStatus,
): void {
  if (!sessionId) return;
  const map = readMap();
  if (!messages || messages.length === 0) {
    if (!(sessionId in map)) return;
    delete map[sessionId];
    writeMap(map);
    return;
  }
  map[sessionId] = {
    messages: messages.map((message) => ({
      id: message.id,
      text: message.text,
      attachments: [],
      intent: message.intent,
    })),
    status: status === "paused" ? "paused" : "active",
  };
  const ids = Object.keys(map);
  if (ids.length > MAX_SESSIONS) {
    for (const id of ids.slice(0, ids.length - MAX_SESSIONS)) {
      delete map[id];
    }
  }
  writeMap(map);
}

export function resetPersistedQueues(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
