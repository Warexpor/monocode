import { describe, expect, it } from "vitest";
import type { Block, Session } from "./session";
import {
  applyTranscriptMutation,
  isTurnOpeningUserBlock,
} from "./transcriptMutation";

function user(
  id: string,
  text: string,
  extra?: Partial<Block>,
): Block {
  return { id, role: "user", text, startedAt: 1, ...extra };
}

function steer(id: string, text: string): Block {
  return { id, role: "user", text };
}

function assistant(id: string, text: string): Block {
  return { id, role: "assistant", text };
}

function session(blocks: Block[], busy = false): Pick<Session, "blocks" | "busy"> {
  return { blocks, busy };
}

describe("isTurnOpeningUserBlock", () => {
  it("accepts users with startedAt", () => {
    const blocks = [user("u1", "hi"), assistant("a1", "yo")];
    expect(isTurnOpeningUserBlock(blocks, blocks[0])).toBe(true);
  });

  it("rejects mid-turn steers without startedAt", () => {
    const blocks = [user("u1", "hi"), steer("s1", "also"), assistant("a1", "ok")];
    expect(isTurnOpeningUserBlock(blocks, blocks[1])).toBe(false);
  });

  it("allows a sole steer-shaped user", () => {
    const blocks = [steer("only", "hello")];
    expect(isTurnOpeningUserBlock(blocks, blocks[0])).toBe(true);
  });
});

describe("applyTranscriptMutation", () => {
  it("refuses while busy", () => {
    const result = applyTranscriptMutation(session([user("u1", "hi")], true), {
      kind: "editResend",
      userBlockId: "u1",
    });
    expect(result).toEqual({ ok: false, error: "busy" });
  });

  it("refuses missing and non-user anchors", () => {
    const blocks = [user("u1", "hi"), assistant("a1", "yo")];
    expect(
      applyTranscriptMutation(session(blocks), {
        kind: "editResend",
        userBlockId: "missing",
      }),
    ).toEqual({ ok: false, error: "not_found" });
    expect(
      applyTranscriptMutation(session(blocks), {
        kind: "editResend",
        userBlockId: "a1",
      }),
    ).toEqual({ ok: false, error: "not_user" });
  });

  it("refuses steer anchors mid-turn", () => {
    const blocks = [user("u1", "hi"), steer("s1", "nudge"), assistant("a1", "ok")];
    expect(
      applyTranscriptMutation(session(blocks), {
        kind: "truncateAfterTurn",
        userBlockId: "s1",
      }),
    ).toEqual({ ok: false, error: "not_user" });
  });

  it("editResend drops the user and seeds the composer", () => {
    const blocks = [
      user("u1", "first"),
      assistant("a1", "ok"),
      user("u2", "second", {
        attachments: [
          {
            id: "f1",
            name: "a.png",
            mimeType: "image/png",
            kind: "image",
            size: 1,
          },
        ],
      }),
      assistant("a2", "sure"),
    ];
    const result = applyTranscriptMutation(session(blocks), {
      kind: "editResend",
      userBlockId: "u2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blocks.map((b) => b.id)).toEqual(["u1", "a1"]);
    expect(result.composerSeed).toEqual({
      text: "second",
      attachments: blocks[2].attachments,
    });
    expect(result.rewindPromptIndex).toBe(1);
    expect(result.removedCount).toBe(2);
  });

  it("truncateAfterTurn keeps the turn and drops later ones", () => {
    const blocks = [
      user("u1", "first"),
      assistant("a1", "ok"),
      user("u2", "second"),
      assistant("a2", "sure"),
      user("u3", "third"),
      assistant("a3", "yep"),
    ];
    const result = applyTranscriptMutation(session(blocks), {
      kind: "truncateAfterTurn",
      userBlockId: "u2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blocks.map((b) => b.id)).toEqual([
      "u1",
      "a1",
      "u2",
      "a2",
    ]);
    expect(result.composerSeed).toBeUndefined();
    expect(result.rewindPromptIndex).toBe(2);
    expect(result.removedCount).toBe(2);
  });

  it("truncateAfterTurn returns empty when nothing follows", () => {
    const blocks = [user("u1", "only"), assistant("a1", "ok")];
    expect(
      applyTranscriptMutation(session(blocks), {
        kind: "truncateAfterTurn",
        userBlockId: "u1",
      }),
    ).toEqual({ ok: false, error: "empty" });
  });

  it("seals streaming and strips undecided approvals on the kept edge", () => {
    const blocks = [
      user("u1", "first"),
      {
        id: "a1",
        role: "assistant" as const,
        text: "partial",
        streaming: true,
      },
      {
        id: "ap1",
        role: "approval" as const,
        text: "Allow?",
        approval: { requestId: 9 },
      },
      user("u2", "later"),
      assistant("a2", "gone"),
    ];
    const result = applyTranscriptMutation(session(blocks), {
      kind: "truncateAfterTurn",
      userBlockId: "u1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blocks.map((b) => b.id)).toEqual(["u1", "a1"]);
    expect(result.blocks[1].streaming).toBe(false);
  });

  it("prefers stored promptIndex for rewind", () => {
    const blocks = [
      user("u1", "first", { promptIndex: 0 }),
      assistant("a1", "ok"),
      user("u2", "second", { promptIndex: 7 }),
      assistant("a2", "sure"),
    ];
    const result = applyTranscriptMutation(session(blocks), {
      kind: "editResend",
      userBlockId: "u2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rewindPromptIndex).toBe(7);
  });

  it("keeps steers inside the truncated turn", () => {
    const blocks = [
      user("u1", "first"),
      steer("s1", "nudge"),
      assistant("a1", "ok"),
      user("u2", "next"),
      assistant("a2", "bye"),
    ];
    const result = applyTranscriptMutation(session(blocks), {
      kind: "truncateAfterTurn",
      userBlockId: "u1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blocks.map((b) => b.id)).toEqual(["u1", "s1", "a1"]);
  });
});
