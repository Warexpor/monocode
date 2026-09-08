import { normalizeProjectPath } from "../recents";
import {
  nativeCommandInvocation,
  type CommandContext,
  type NativeCommand,
  type NativeCommandProvider,
} from "./nativeCommands";
import { asRecord } from "./grokProtocol";

const commandListeners = new Map<
  string,
  Set<(commands: NativeCommand[]) => void>
>();

const commandsByThread = new Map<string, NativeCommand[]>();

function commandContextKey(context: CommandContext): string {
  return `${context.sessionId ?? ""}\0${normalizeProjectPath(context.cwd)}`;
}

export function setGrokAvailableCommands(
  sessionId: string,
  cwd: string,
  commands: NativeCommand[],
): void {
  commandsByThread.set(sessionId, commands);
  const key = commandContextKey({ sessionId, cwd });
  for (const listener of commandListeners.get(key) ?? []) listener(commands);
}

export function clearGrokAvailableCommands(sessionId: string): void {
  commandsByThread.delete(sessionId);
}

export function peekGrokAvailableCommands(
  sessionId: string,
): NativeCommand[] | undefined {
  return commandsByThread.get(sessionId);
}

/** Parse ACP `available_commands_update` / `x.ai/commands/list` payloads. */
export function grokCommandsFromAcp(data: unknown): NativeCommand[] {
  const rec = asRecord(data);
  const list =
    (Array.isArray(rec?.availableCommands) && rec.availableCommands) ||
    (Array.isArray(rec?.available_commands) && rec.available_commands) ||
    (Array.isArray(rec?.commands) && rec.commands) ||
    (Array.isArray(data) ? data : null);
  if (!list) return [];

  const seen = new Set<string>();
  return list.flatMap((value): NativeCommand[] => {
    const row = asRecord(value);
    const name = row?.name;
    if (
      typeof name !== "string" ||
      !name ||
      /[\s/\\]/.test(name) ||
      seen.has(name)
    ) {
      return [];
    }
    seen.add(name);
    const input = asRecord(row?.input);
    const hint =
      (typeof input?.hint === "string" && input.hint) ||
      (typeof row?.inputHint === "string" && row.inputHint) ||
      undefined;
    const meta = asRecord(row?._meta) ?? asRecord(row?.meta);
    const origin =
      (typeof meta?.scope === "string" && meta.scope) ||
      (typeof meta?.pluginName === "string" && meta.pluginName) ||
      (typeof meta?.workflowSource === "string" && "workflow") ||
      (typeof row?.source === "string" && row.source) ||
      "builtin";
    const aliases = Array.isArray(row?.aliases)
      ? row.aliases.filter(
          (alias): alias is string =>
            typeof alias === "string" && !!alias && !/[\s/\\]/.test(alias),
        )
      : [];
    return [
      {
        name,
        invocation: nativeCommandInvocation("grok", name),
        source: "grok",
        description:
          typeof row?.description === "string" ? row.description : "",
        origin,
        ...(aliases.length ? { aliases } : {}),
        ...(hint ? { inputHint: hint } : {}),
      },
    ];
  });
}

export const grokCommandProvider: NativeCommandProvider = {
  rawSlashCommands: true,
  async discover(context) {
    if (!context.sessionId) return [];
    return commandsByThread.get(context.sessionId) ?? [];
  },
  subscribe(context, onCommands) {
    const key = commandContextKey(context);
    let listeners = commandListeners.get(key);
    if (!listeners) commandListeners.set(key, (listeners = new Set()));
    listeners.add(onCommands);
    const live =
      context.sessionId != null
        ? commandsByThread.get(context.sessionId)
        : undefined;
    if (live) onCommands(live);
    return () => {
      listeners.delete(onCommands);
      if (!listeners.size) commandListeners.delete(key);
    };
  },
};

/** Mid-turn aside: `/btw …` should call ACP instead of queueing. */
export function parseGrokBtwPrompt(text: string): string | null {
  const match = /^\s*\/btw(?:\s+|$)([\s\S]*)$/i.exec(text);
  if (!match) return null;
  const question = match[1]?.trim() ?? "";
  return question || null;
}
