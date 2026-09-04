import { describe, expect, it } from "vitest";
import type { Session } from "../lib/session";
import { rewindSessionToUserBlock } from "./rewindSession";

function session(blocks: Session["blocks"]): Session {
  return {
    id: "s1",
    harness: "claude",
    model: "sonnet",
    modelSettings: {},
    runtimeMode: "supervised",
    title: "Test",
    cwd: "C:/proj",
    blocks,
    busy: true,
    providerSessionId: "prov-1",
    queuedMessages: [
      {
        id: "q1",
        text: "later",
        attachments: [],
      },
    ],
    queueStatus: "paused",
    pendingSwitch: {
      from: "claude",
      fromModel: "sonnet",
      fromSettings: {},
    },
    context: { used: 1, window: 2 },
  };
}

describe("rewindSessionToUserBlock", () => {
  it("drops the target user turn and everything after, seeds the composer", () => {
    const before = session([
      { id: "u1", role: "user", text: "first" },
      { id: "a1", role: "assistant", text: "ok" },
      { id: "u2", role: "user", text: "second" },
      { id: "a2", role: "assistant", text: "again" },
    ]);
    const next = rewindSessionToUserBlock(before, "u2");
    expect(next).not.toBeNull();
    expect(next!.blocks.map((block) => block.id)).toEqual(["u1", "a1"]);
    expect(next!.composerSeed).toBe("second");
    expect(next!.providerSessionId).toBeUndefined();
    expect(next!.busy).toBe(false);
    expect(next!.queuedMessages).toBeUndefined();
    expect(next!.pendingSwitch).toBeUndefined();
    expect(next!.context).toBeUndefined();
  });

  it("returns null for unknown or non-user blocks", () => {
    const before = session([
      { id: "u1", role: "user", text: "hi" },
      { id: "a1", role: "assistant", text: "yo" },
    ]);
    expect(rewindSessionToUserBlock(before, "a1")).toBeNull();
    expect(rewindSessionToUserBlock(before, "missing")).toBeNull();
  });
});
