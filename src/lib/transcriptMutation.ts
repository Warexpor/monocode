import type { Attachment, Block, Session } from "./session";

export type TranscriptMutation =
  | {
      kind: "editResend";
      /** Drop this user block and everything after; seed composer from it. */
      userBlockId: string;
    }
  | {
      kind: "truncateAfterTurn";
      /** Keep the full turn containing this user block; drop later turns. */
      userBlockId: string;
    };

export type TranscriptMutationResult =
  | {
      ok: true;
      blocks: Block[];
      composerSeed?: { text: string; attachments?: Attachment[] };
      /** 0-based index among turn-opening user blocks of the first removed user turn (for Grok rewind). */
      rewindPromptIndex: number | null;
      removedCount: number;
    }
  | { ok: false; error: "busy" | "not_found" | "not_user" | "empty" };

/** Turn-opening users carry startedAt; steers without it are mid-turn unless alone. */
export function isTurnOpeningUserBlock(
  blocks: Block[],
  block: Block,
): boolean {
  if (block.role !== "user") return false;
  if (block.startedAt != null) return true;
  const users = blocks.filter((entry) => entry.role === "user");
  return users.length === 1 && users[0].id === block.id;
}

export function turnOpeningUserBlocks(blocks: Block[]): Block[] {
  return blocks.filter((block) => isTurnOpeningUserBlock(blocks, block));
}

/** True when truncating after this opener would drop at least one later turn. */
export function hasLaterTurnOpening(
  blocks: Block[],
  userBlockId: string,
): boolean {
  const openers = turnOpeningUserBlocks(blocks);
  const index = openers.findIndex((block) => block.id === userBlockId);
  return index >= 0 && index < openers.length - 1;
}

export function applyTranscriptMutation(
  session: Pick<Session, "blocks" | "busy">,
  mutation: TranscriptMutation,
): TranscriptMutationResult {
  if (session.busy) return { ok: false, error: "busy" };

  const { blocks } = session;
  const anchorIndex = blocks.findIndex(
    (block) => block.id === mutation.userBlockId,
  );
  if (anchorIndex < 0) return { ok: false, error: "not_found" };

  const anchor = blocks[anchorIndex];
  if (anchor.role !== "user") return { ok: false, error: "not_user" };
  if (!isTurnOpeningUserBlock(blocks, anchor)) {
    return { ok: false, error: "not_user" };
  }

  const openers = turnOpeningUserBlocks(blocks);
  const openerOrdinal = openers.findIndex((block) => block.id === anchor.id);

  let cutExclusive: number;
  let composerSeed: { text: string; attachments?: Attachment[] } | undefined;
  let firstRemovedOpener: Block | null = null;

  if (mutation.kind === "editResend") {
    cutExclusive = anchorIndex;
    firstRemovedOpener = anchor;
    composerSeed = {
      text: anchor.text,
      ...(anchor.attachments?.length
        ? { attachments: anchor.attachments }
        : {}),
    };
  } else {
    cutExclusive = turnEndExclusive(blocks, anchorIndex);
    if (cutExclusive >= blocks.length) {
      return { ok: false, error: "empty" };
    }
    firstRemovedOpener =
      blocks
        .slice(cutExclusive)
        .find((block) => isTurnOpeningUserBlock(blocks, block)) ?? null;
  }

  const kept = sealKeptBlocks(
    stripUndecidedApprovals(blocks.slice(0, cutExclusive)),
  );
  const removedCount = blocks.length - cutExclusive;

  return {
    ok: true,
    blocks: kept,
    ...(composerSeed ? { composerSeed } : {}),
    rewindPromptIndex: rewindIndexFor(
      firstRemovedOpener,
      openerOrdinal,
      mutation,
    ),
    removedCount,
  };
}

function rewindIndexFor(
  firstRemovedOpener: Block | null,
  anchorOpenerOrdinal: number,
  mutation: TranscriptMutation,
): number | null {
  if (!firstRemovedOpener) return null;
  if (typeof firstRemovedOpener.promptIndex === "number") {
    return firstRemovedOpener.promptIndex;
  }
  if (mutation.kind === "editResend") {
    return anchorOpenerOrdinal >= 0 ? anchorOpenerOrdinal : null;
  }
  // First removed opener is the next turn after the kept anchor.
  return anchorOpenerOrdinal >= 0 ? anchorOpenerOrdinal + 1 : null;
}

function turnEndExclusive(blocks: Block[], openerIndex: number): number {
  for (let index = openerIndex + 1; index < blocks.length; index += 1) {
    if (isTurnOpeningUserBlock(blocks, blocks[index])) return index;
  }
  return blocks.length;
}

function sealKeptBlocks(blocks: Block[]): Block[] {
  return blocks.map((block) =>
    block.streaming ? { ...block, streaming: false } : block,
  );
}

/** Drop live undecided approval prompts that cannot survive a truncate. */
function stripUndecidedApprovals(blocks: Block[]): Block[] {
  const next: Block[] = [];
  for (const block of blocks) {
    if (block.approval && block.approval.decided == null) {
      if (block.role === "approval") continue;
      const { approval: _drop, ...rest } = block;
      next.push(rest);
      continue;
    }
    next.push(block);
  }
  return next;
}
