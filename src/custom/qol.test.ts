import { describe, expect, it, beforeEach } from "vitest";
import {
  clearComposerDraft,
  loadComposerDraft,
  resetComposerDrafts,
  saveComposerDraft,
} from "./composerDraft";
import {
  loadPromptHistory,
  pushPromptHistory,
  resetPromptHistory,
  stepPromptHistory,
} from "./promptHistory";
import {
  loadPreferredRuntimeMode,
  resetPreferredRuntimeMode,
  savePreferredRuntimeMode,
} from "./preferredRuntimeMode";
import {
  loadProjectDefault,
  resetProjectDefaults,
  saveProjectDefault,
} from "./projectDefaults";
import { sessionTranscriptMarkdown } from "./transcriptExport";
import {
  loadPersistedQueue,
  resetPersistedQueues,
  savePersistedQueue,
} from "./queuePersist";
import type { Session } from "../lib/session";

function mockLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
}

beforeEach(() => {
  mockLocalStorage();
  resetComposerDrafts();
  resetPromptHistory();
  resetPreferredRuntimeMode();
  resetProjectDefaults();
  resetPersistedQueues();
});

describe("composerDraft", () => {
  it("saves and loads per session", () => {
    saveComposerDraft("s1", "hello");
    expect(loadComposerDraft("s1")).toBe("hello");
    expect(loadComposerDraft("s2")).toBe("");
    clearComposerDraft("s1");
    expect(loadComposerDraft("s1")).toBe("");
  });
});

describe("promptHistory", () => {
  it("pushes newest first and steps like a shell", () => {
    pushPromptHistory("one");
    pushPromptHistory("two");
    expect(loadPromptHistory()).toEqual(["two", "one"]);
    const older = stepPromptHistory(loadPromptHistory(), -1, "older", "live");
    expect(older).toEqual({ index: 0, text: "two" });
    const older2 = stepPromptHistory(
      loadPromptHistory(),
      older.index,
      "older",
      "live",
    );
    expect(older2).toEqual({ index: 1, text: "one" });
    const newer = stepPromptHistory(
      loadPromptHistory(),
      older2.index,
      "newer",
      "live",
    );
    expect(newer).toEqual({ index: 0, text: "two" });
    const live = stepPromptHistory(
      loadPromptHistory(),
      newer.index,
      "newer",
      "live",
    );
    expect(live).toEqual({ index: -1, text: "live" });
  });
});

describe("preferredRuntimeMode", () => {
  it("defaults to supervised and remembers a choice", () => {
    expect(loadPreferredRuntimeMode()).toBe("supervised");
    savePreferredRuntimeMode("auto");
    expect(loadPreferredRuntimeMode()).toBe("auto");
  });
});

describe("projectDefaults", () => {
  it("stores harness/model per project path", () => {
    saveProjectDefault("C:/proj", "grok", "grok:grok-4.6");
    expect(loadProjectDefault("C:/proj")).toEqual({
      harness: "grok",
      model: "grok:grok-4.6",
    });
  });
});

describe("transcriptExport", () => {
  it("renders markdown with user and assistant turns", () => {
    const session: Session = {
      id: "s1",
      harness: "grok",
      model: "grok:grok-4.6",
      modelSettings: {},
      runtimeMode: "supervised",
      title: "Demo",
      cwd: "C:/proj",
      blocks: [
        { id: "u1", role: "user", text: "hi" },
        { id: "a1", role: "assistant", text: "hello" },
        {
          id: "t1",
          role: "tool",
          text: "read",
          tool: { callId: "c1", title: "Read" },
        },
      ],
      busy: false,
    };
    const md = sessionTranscriptMarkdown(session);
    expect(md).toContain("# Demo");
    expect(md).toContain("## User");
    expect(md).toContain("hi");
    expect(md).toContain("## Assistant");
    expect(md).not.toContain("## Tool");
  });
});

describe("queuePersist", () => {
  it("round-trips queued text without attachments", () => {
    savePersistedQueue(
      "s1",
      [{ id: "q1", text: "later", attachments: [], intent: "default" }],
      "paused",
    );
    expect(loadPersistedQueue("s1")).toEqual({
      messages: [{ id: "q1", text: "later", attachments: [], intent: "default" }],
      status: "paused",
    });
  });
});
