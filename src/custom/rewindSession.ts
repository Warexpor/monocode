import type { Block, Session } from "../lib/session";

/**
 * Truncate the transcript to just before `blockId`, seed the composer with
 * that user turn's text, and clear provider resume so the next send is fresh.
 * File checkpoints are intentionally left alone.
 */
export function rewindSessionToUserBlock(
  session: Session,
  blockId: string,
): Session | null {
  const index = session.blocks.findIndex(
    (block) => block.id === blockId && block.role === "user",
  );
  if (index < 0) return null;

  const target = session.blocks[index];
  if (!target || target.role !== "user") return null;

  const seed = composerSeedFromUserBlock(target);

  return {
    ...session,
    blocks: session.blocks.slice(0, index),
    busy: false,
    providerSessionId: undefined,
    pendingQuestion: undefined,
    pendingSwitch: undefined,
    queuedMessages: undefined,
    queueStatus: undefined,
    editingQueuedMessageId: undefined,
    context: undefined,
    handoffCard: undefined,
    composerSeed: seed,
  };
}

export function composerSeedFromUserBlock(block: Block): string | undefined {
  if (block.role !== "user") return undefined;
  const text = block.text.trim();
  return text.length > 0 ? block.text : undefined;
}

export function canRewindToUserBlock(
  blocks: Block[],
  blockId: string,
): boolean {
  return blocks.some((block) => block.id === blockId && block.role === "user");
}
