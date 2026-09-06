import { promptBlocks, type PromptContentBlock } from "../attachments";
import type { AgentModel, ModelSetting, ModelSettingChoice } from "../models";
import type { Attachment, RuntimeMode, ToolPreview } from "../session";
import { normalizeTaskListStatus } from "../taskList";
import type { ApprovalDecision, HarnessEvent } from "./types";
import type { UserQuestion, UserQuestionReply } from "../userQuestion";
import { questionsFromUnknown, selectedAnswerLabels } from "../userQuestion";
import {
  composeToolTitle,
  extractSearchQuery,
  extractShellCommand,
  extractSkillName,
  extractToolPreview,
} from "./preview";

export const AUTH_HELP =
  "Grok Build is not signed in. Run `grok login` in a terminal, or set XAI_API_KEY.";

export function isMethodNotFound(error: unknown): boolean {
  if (!error) return false;
  const code =
    typeof error === "object" && error && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === -32601) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /method not found|-32601/i.test(message);
}

export const TEXT_MODEL = "grok-4.6";

const VARIANT_KIND: Record<string, string> = {
  readfile: "read",
  read: "read",
  write: "edit",
  edit: "edit",
  searchreplace: "edit",
  search_replace: "edit",
  bash: "execute",
  execute: "execute",
  run_terminal_cmd: "execute",
  run_terminal_command: "execute",
  grep: "search",
  search: "search",
  webfetch: "fetch",
  web_fetch: "fetch",
  websearch: "search",
  web_search: "search",
  listdir: "read",
  list_dir: "read",
  agent: "agent",
  task: "agent",
  subagent: "agent",
  spawn_subagent: "agent",
  send_subagent_message: "agent",
  get_task_output: "execute",
  get_command_or_subagent_output: "execute",
  wait_tasks: "execute",
  kill_task: "execute",
  kill_command_or_subagent: "execute",
  monitor: "execute",
  scheduler_create: "execute",
  scheduler_list: "read",
  scheduler_delete: "execute",
  image_gen: "other",
  imagegen: "other",
  image_edit: "other",
  imageedit: "other",
  image_to_video: "other",
  imagetovideo: "other",
  reference_to_video: "other",
  referencetovideo: "other",
  workflow: "agent",
  update_goal: "agent",
  skill: "read",
  search_tool: "search",
  use_tool: "execute",
  memory_search: "search",
  memory_get: "read",
  lsp: "search",
  todo_write: "edit",
  todowrite: "edit",
  ask_user_question: "other",
  enter_plan_mode: "other",
  exit_plan_mode: "other",
};

/** Readable activity titles for media / generation tools. */
const VARIANT_TITLE: Record<string, string> = {
  image_gen: "Generating image",
  imagegen: "Generating image",
  image_edit: "Editing image",
  imageedit: "Editing image",
  image_to_video: "Generating video",
  imagetovideo: "Generating video",
  reference_to_video: "Generating video",
  referencetovideo: "Generating video",
};

export type GrokRewindPoint = {
  promptIndex: number;
  promptPreview?: string;
  createdAt?: string;
  numFileSnapshots?: number;
  hasFileChanges?: boolean;
};

const EFFORT_LABELS: Record<string, string> = {
  xhigh: "Extra High",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export type GrokPermissionRequest = {
  title: string;
  kind?: string;
  callId?: string;
  preview?: ToolPreview;
  optionIds: string[];
};

export type GrokAskQuestion = UserQuestion;

export function askQuestionsFromAcp(params: unknown): UserQuestion[] {
  return questionsFromUnknown(params);
}

export function askQuestionResponse(
  reply: UserQuestionReply,
  questions: UserQuestion[],
): Record<string, unknown> {
  if (reply.kind !== "answered") return { outcome: "skip_interview" };
  const answers: Record<string, string | string[]> = {};
  for (const question of questions) {
    const labels = selectedAnswerLabels(question, reply);
    if (labels.length === 0) continue;
    answers[question.prompt] = question.multiSelect
      ? labels
      : (labels[0] ?? "");
  }
  return { outcome: "accepted", answers };
}

/** Grok accepts ACP image blocks despite advertising image: false. */
export function grokPromptBlocks(
  text: string,
  attachments: Attachment[] = [],
): PromptContentBlock[] {
  return promptBlocks(text, attachments);
}

export function grokSpawnArgs(input: {
  model: string;
  effort?: string;
  fullAccess?: boolean;
  plan?: boolean;
}): string[] {
  const args = ["--no-auto-update"];
  if (input.plan) args.push("--permission-mode", "plan");
  args.push("agent", "--no-leader");
  const native = nativeId(input.model);
  if (native) args.push("--model", native);
  const effort = input.effort?.trim();
  if (effort) args.push("--reasoning-effort", effort);
  if (input.fullAccess) args.push("--always-approve");
  args.push("stdio");
  return args;
}

export function grokTextSpawnArgs(): string[] {
  return [
    "--no-auto-update",
    "--permission-mode",
    "dontAsk",
    "agent",
    "--no-leader",
    "--model",
    TEXT_MODEL,
    "--reasoning-effort",
    "low",
    "stdio",
  ];
}

export function grokSessionNewParams(
  cwd: string,
  runtimeMode: RuntimeMode,
): Record<string, unknown> {
  const params: Record<string, unknown> = { cwd, mcpServers: [] };
  if (runtimeMode === "full-access") {
    params._meta = { yoloMode: true };
  } else if (runtimeMode === "auto") {
    params._meta = { autoMode: true };
  }
  return params;
}

export function grokEffort(
  settings?: Record<string, string>,
): string | undefined {
  const value = settings?.effort?.trim() || settings?.reasoning?.trim();
  return value || undefined;
}

/**
 * Never pick `grok.com` — that starts a browser OAuth flow with no headless
 * completion path. Prefer an API key when the agent advertised it (it saw
 * XAI_API_KEY), otherwise the cached `grok login` token.
 */
export function grokAuthMethodId(init: unknown): string | null {
  const rec = asRecord(init);
  const methods = Array.isArray(rec?.authMethods) ? rec.authMethods : [];
  const ids = new Set(
    methods.flatMap((item) => {
      const id = asRecord(item)?.id;
      return typeof id === "string" && id.trim() && id !== "grok.com"
        ? [id.trim()]
        : [];
    }),
  );
  const defaultId = stringField(
    asRecord(rec?._meta) ?? {},
    "defaultAuthMethodId",
  );
  if (ids.has("xai.api_key")) return "xai.api_key";
  if (defaultId && ids.has(defaultId)) return defaultId;
  if (ids.has("cached_token")) return "cached_token";
  const first = [...ids][0];
  return first ?? null;
}

export function grokAuthError(error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  if (/auth|login|credential|api key|XAI_API_KEY/i.test(detail)) {
    return new Error(`${detail.trim()}\n\n${AUTH_HELP}`);
  }
  if (/timed out/i.test(detail)) {
    return new Error(`Grok Build did not start. ${AUTH_HELP}`);
  }
  return new Error(`Grok Build did not start. ${detail}`);
}

export function pickAutoOption(
  runtimeMode: RuntimeMode,
  kind: string | undefined,
  optionIds: string[],
): string | null {
  if (optionIds.length === 0) return null;
  const tool = (kind ?? "").toLowerCase();
  if (runtimeMode === "supervised") return null;
  if (
    runtimeMode === "auto-accept-edits" &&
    (tool === "execute" || tool === "other" || tool === "fetch")
  ) {
    return null;
  }
  if (runtimeMode === "full-access") {
    return pickOption(optionIds, [
      "allow-always",
      "allow_always",
      "allow-once",
      "allow_once",
      "allow",
    ]);
  }
  return pickOption(optionIds, [
    "allow-once",
    "allow_once",
    "allow-always",
    "allow_always",
    "allow",
  ]);
}

export function permissionOptionId(
  decision: ApprovalDecision,
  optionIds: string[],
): string {
  if (decision === "allow") {
    return (
      pickOption(optionIds, [
        "allow-once",
        "allow_once",
        "allow-always",
        "allow_always",
        "allow",
      ]) ?? "allow-once"
    );
  }
  return (
    pickOption(optionIds, [
      "reject-once",
      "reject_once",
      "reject-always",
      "reject_always",
      "reject",
      "deny",
    ]) ?? "reject-once"
  );
}

export function permissionRequestFromAcp(
  params: unknown,
): GrokPermissionRequest {
  const rec = asRecord(params);
  const subject = asRecord(rec?.subject);
  const tool =
    asRecord(rec?.toolCall) ??
    asRecord(rec?.tool_call) ??
    asRecord(subject?.toolCall) ??
    asRecord(subject) ??
    rec ??
    {};
  const grok = grokToolFields(tool, tool);
  const kind =
    grok.kind ??
    stringField(tool, "kind") ??
    stringField(subject ?? {}, "kind");
  const preview = extractToolPreview(tool, tool);
  const command = grok.command ?? extractShellCommand(tool);
  const title =
    composeToolTitle({
      kind,
      title: grok.title ?? toolLabel(tool),
      command,
      skill: extractSkillName(tool),
      path: grok.path ?? preview?.path,
      query: grok.query ?? preview?.query ?? extractSearchQuery(tool),
      previewKind: preview?.kind,
    }) ||
    grok.title ||
    toolLabel(tool) ||
    "Permission";
  const options = Array.isArray(rec?.options) ? rec.options : [];
  const optionIds = options
    .map((item) => asRecord(item)?.optionId ?? asRecord(item)?.option_id)
    .filter((value): value is string => typeof value === "string");

  return {
    title,
    kind,
    callId:
      grok.callId ??
      stringField(tool, "toolCallId") ??
      stringField(tool, "tool_call_id") ??
      stringField(rec ?? {}, "toolCallId"),
    preview: mergePreview(preview, grok.path, grok.query, kind),
    optionIds,
  };
}

export function planFromExitPlan(params: unknown): string {
  const rec = asRecord(params);
  const nested = asRecord(rec?.input);
  const text =
    rec?.planContent ??
    rec?.plan ??
    rec?.content ??
    nested?.plan ??
    nested?.planContent;
  return typeof text === "string" ? text.trim() : "";
}

export function eventsFromAcpUpdate(params: unknown): HarnessEvent[] {
  const rec = asRecord(params);
  const update = asRecord(rec?.update) ?? rec;
  if (!update) return [];
  const kind = String(
    update.sessionUpdate ?? update.session_update ?? update.type ?? "",
  );

  const promptIndexEvent = promptIndexFromUpdate(update, rec);
  const withPromptIndex = (events: HarnessEvent[]): HarnessEvent[] =>
    promptIndexEvent ? [promptIndexEvent, ...events] : events;

  if (
    kind === "user_message_chunk" ||
    kind === "user_message" ||
    kind === "user_message_end" ||
    kind.startsWith("user_message")
  ) {
    return promptIndexEvent ? [promptIndexEvent] : [];
  }

  if (kind === "agent_message_chunk" || kind === "agent_message") {
    const text = textFromContent(
      update.content ?? update.text,
      kind === "agent_message" ? "\n" : "",
    );
    return withPromptIndex(text ? [{ type: "message.delta", text }] : []);
  }

  if (kind === "agent_thought_chunk" || kind === "agent_thought") {
    const text = textFromContent(
      update.content ?? update.text,
      kind === "agent_thought" ? "\n" : "",
    );
    return withPromptIndex(text ? [{ type: "reasoning.delta", text }] : []);
  }

  if (kind === "tool_call_delta_chunk") {
    const callId =
      stringField(update, "toolCallId") ??
      stringField(update, "tool_call_id") ??
      "";
    if (!callId) return [];
    const name = stringField(update, "name") ?? stringField(update, "title");
    return [
      {
        type: "tool.updated",
        callId,
        title: name ? humanizeToolName(name) : undefined,
        kind: kindFromName(name),
        status: "pending",
      },
    ];
  }

  if (
    kind === "tool_call" ||
    kind === "tool_call_update" ||
    kind === "tool_call_content_chunk"
  ) {
    const tool =
      asRecord(update.toolCall) ?? asRecord(update.tool_call) ?? update;
    const grok = grokToolFields(update, tool);
    const callId =
      grok.callId ??
      String(
        tool.toolCallId ??
          tool.tool_call_id ??
          update.toolCallId ??
          update.tool_call_id ??
          "",
      );
    if (!callId) return [];
    const toolKind =
      grok.kind ?? stringField(update, "kind") ?? stringField(tool, "kind");
    const status = stringField(update, "status") ?? stringField(tool, "status");
    const preview = mergePreview(
      extractToolPreview(update, tool),
      grok.path,
      grok.query,
      toolKind,
    );
    const title =
      composeToolTitle({
        kind: toolKind,
        title: grok.title ?? toolLabel(update) ?? toolLabel(tool),
        command:
          grok.command ??
          extractShellCommand(
            update.rawInput,
            tool.rawInput,
            update.raw_input,
            tool.raw_input,
            update.input,
            tool.input,
            grok.input,
          ),
        skill: extractSkillName(
          update.rawInput,
          tool.rawInput,
          update.raw_input,
          tool.raw_input,
          update.input,
          tool.input,
        ),
        path: preview?.path,
        query: preview?.query ?? grok.query,
        previewKind: preview?.kind,
      }) ||
      grok.title ||
      toolLabel(update) ||
      toolLabel(tool);
    const updated: HarnessEvent = {
      type: "tool.updated",
      callId,
      title,
      kind: toolKind,
      status,
      detail: cap(toolDetail(update, tool) ?? "") || undefined,
      preview,
    };
    if (kind === "tool_call") {
      return [
        {
          type: "tool.started",
          callId,
          title: title || humanizeToolName(callId),
          kind: toolKind,
          status: status ?? "pending",
          preview,
        },
        updated,
      ];
    }
    return [updated];
  }

  if (kind === "plan" || kind === "current_plan") {
    const event = planEvent(update);
    return event ? [event] : [];
  }

  if (kind === "session_summary_generated") {
    const text = sessionSummaryText(update, rec);
    // Grok often emits this every turn with an empty payload; only surface a
    // status when there is real summary content to show.
    return text ? [{ type: "status", text }] : [];
  }

  if (kind === "available_commands_update") {
    // Handled by the Grok command provider, not the transcript.
    return [];
  }

  if (kind === "session_recap") {
    const summary =
      stringField(update, "summary") ??
      textFromContent(update.content ?? update.summary, "\n");
    return summary?.trim()
      ? [{ type: "status", text: `Recap: ${summary.trim()}` }]
      : [];
  }

  if (kind === "auto_compact_started") {
    const percentage = numberField(update, "percentage");
    const reason = stringField(update, "reason");
    const pct = percentage != null ? ` (${percentage}%)` : "";
    return [
      {
        type: "status",
        text: reason?.trim()
          ? `Compacting context${pct}: ${reason.trim()}`
          : `Compacting context${pct}`,
      },
    ];
  }

  if (kind === "auto_compact_completed") {
    const after = numberField(update, "tokens_after");
    const preview = stringField(update, "summary_preview");
    return [
      {
        type: "status",
        text: preview?.trim()
          ? `Compacted context${after != null ? ` · ${after} tokens` : ""}: ${preview.trim()}`
          : `Compacted context${after != null ? ` · ${after} tokens` : ""}`,
      },
    ];
  }

  if (kind === "auto_compact_failed") {
    const error = stringField(update, "error") ?? "compaction failed";
    return [{ type: "status", text: `Compact failed: ${error}` }];
  }

  if (
    kind === "memory_flush_started" ||
    kind === "memory_flush_completed" ||
    kind === "memory_dream_completed" ||
    kind === "memory_session_saved"
  ) {
    const result =
      stringField(update, "result") ?? stringField(update, "path") ?? kind;
    return [{ type: "status", text: humanizeStatusKind(kind, result) }];
  }

  if (kind === "hook_annotation") {
    const message = stringField(update, "message");
    return message?.trim() ? [{ type: "status", text: message.trim() }] : [];
  }

  const agentEvent = agentEventFromUpdate(kind, update);
  if (agentEvent) return [agentEvent];

  const backgroundEvent = backgroundEventFromUpdate(kind, update);
  if (backgroundEvent) return [backgroundEvent];

  if (kind === "goal_updated") {
    const objective =
      stringField(update, "objective") ?? stringField(update, "title") ?? "Goal";
    const status = stringField(update, "status") ?? "active";
    const phase = stringField(update, "phase");
    const detail = [status, phase, stringField(update, "last_event_detail")]
      .filter(Boolean)
      .join(" · ");
    return [
      {
        type: "background.updated",
        id: `goal:${stringField(update, "goal_id") ?? "current"}`,
        status:
          status === "complete"
            ? "completed"
            : status === "cleared"
              ? "cancelled"
              : status.includes("paused") || status === "blocked"
                ? "failed"
                : "running",
        title: objective,
        detail,
      },
      {
        type: "status",
        text: `Goal (${status}): ${objective}`,
      },
    ];
  }

  if (kind === "workflow_updated") {
    const name =
      stringField(update, "name") ??
      stringField(update, "objective") ??
      "Workflow";
    const statusRaw = (stringField(update, "status") ?? "").toLowerCase();
    const phase =
      stringField(update, "current_phase") ??
      stringField(update, "currentPhase") ??
      stringField(update, "last_event") ??
      stringField(update, "status");
    const runId =
      stringField(update, "run_id") ??
      stringField(update, "runId") ??
      name;
    const status: "running" | "completed" | "failed" | "cancelled" =
      /complete|done|success/.test(statusRaw)
        ? "completed"
        : /fail|error|stop/.test(statusRaw)
          ? "failed"
          : /pause|cancel/.test(statusRaw)
            ? "cancelled"
            : "running";
    return [
      {
        type: "background.updated",
        id: `workflow:${runId}`,
        status,
        title: name,
        detail: phase ?? undefined,
      },
    ];
  }

  if (kind === "diff_review") {
    return [
      {
        type: "status",
        text: "Diff review ready — open Session changes to inspect edits.",
      },
    ];
  }

  const usage = usageFromUpdate(update);
  return usage ? withPromptIndex([usage]) : withPromptIndex([]);
}

function humanizeStatusKind(kind: string, detail: string): string {
  switch (kind) {
    case "memory_flush_started":
      return "Flushing memory…";
    case "memory_flush_completed":
      return `Memory flushed: ${detail}`;
    case "memory_dream_completed":
      return `Memory consolidated: ${detail}`;
    case "memory_session_saved":
      return `Session memory saved: ${detail}`;
    default:
      return detail;
  }
}

function agentEventFromUpdate(
  kind: string,
  update: Record<string, unknown>,
): Extract<HarnessEvent, { type: "agent.updated" }> | null {
  if (
    kind !== "subagent_spawned" &&
    kind !== "subagent_progress" &&
    kind !== "subagent_finished"
  ) {
    return null;
  }
  const id =
    stringField(update, "subagent_id") ??
    stringField(update, "subagentId") ??
    stringField(update, "child_session_id") ??
    stringField(update, "childSessionId");
  if (!id) return null;
  const title =
    stringField(update, "description") ??
    stringField(update, "title") ??
    stringField(update, "subagent_type") ??
    stringField(update, "subagentType") ??
    "Subagent";
  const kindLabel =
    stringField(update, "subagent_type") ??
    stringField(update, "subagentType") ??
    stringField(update, "role") ??
    undefined;
  if (kind === "subagent_spawned") {
    return {
      type: "agent.updated",
      id,
      status: "running",
      title,
      kind: kindLabel,
      model: stringField(update, "model") ?? undefined,
    };
  }
  if (kind === "subagent_progress") {
    const turns = numberField(update, "completed_turns") ?? numberField(update, "completedTurns");
    const durationMs = numberField(update, "duration_ms") ?? numberField(update, "durationMs");
    return {
      type: "agent.updated",
      id,
      status: "running",
      title,
      kind: kindLabel,
      detail: turns != null ? `${turns} turn${turns === 1 ? "" : "s"}` : undefined,
      durationMs: durationMs ?? undefined,
    };
  }
  const error = stringField(update, "error");
  const statusRaw = stringField(update, "status")?.toLowerCase();
  const status: "completed" | "failed" | "cancelled" =
    statusRaw === "cancelled" || statusRaw === "canceled"
      ? "cancelled"
      : error || statusRaw === "failed" || statusRaw === "error"
        ? "failed"
        : "completed";
  const output =
    stringField(update, "final_output") ??
    stringField(update, "finalOutput") ??
    stringField(update, "output");
  return {
    type: "agent.updated",
    id,
    status,
    title,
    kind: kindLabel,
    detail: error ?? (output ? cap(output, 240) : undefined),
    durationMs:
      numberField(update, "duration_ms") ??
      numberField(update, "durationMs") ??
      undefined,
  };
}

function backgroundEventFromUpdate(
  kind: string,
  update: Record<string, unknown>,
): Extract<HarnessEvent, { type: "background.updated" }> | null {
  if (
    kind !== "task_completed" &&
    kind !== "task_backgrounded" &&
    kind !== "monitor_event" &&
    kind !== "scheduled_task_created" &&
    kind !== "scheduled_task_fired" &&
    kind !== "scheduled_task_deleted" &&
    kind !== "scheduled_task_completed"
  ) {
    return null;
  }
  const snapshot = asRecord(update.task_snapshot) ?? asRecord(update.taskSnapshot);
  const id =
    stringField(update, "task_id") ??
    stringField(update, "taskId") ??
    stringField(snapshot ?? {}, "id") ??
    stringField(snapshot ?? {}, "task_id") ??
    stringField(update, "job_id") ??
    stringField(update, "jobId") ??
    stringField(update, "id");
  if (!id && kind === "monitor_event") {
    const line =
      stringField(update, "line") ??
      stringField(update, "text") ??
      stringField(update, "message");
    if (!line?.trim()) return null;
    return {
      type: "background.updated",
      id: `monitor:${hashId(line)}`,
      status: "running",
      title: "Monitor",
      detail: cap(line.trim(), 240),
    };
  }
  if (!id) return null;
  const title =
    stringField(update, "title") ??
    stringField(snapshot ?? {}, "title") ??
    stringField(snapshot ?? {}, "command") ??
    stringField(update, "command") ??
    stringField(update, "prompt") ??
    "Background task";
  if (kind === "task_backgrounded" || kind === "scheduled_task_created") {
    return {
      type: "background.updated",
      id,
      status: "running",
      title,
      detail: stringField(update, "detail") ?? undefined,
    };
  }
  if (kind === "scheduled_task_deleted") {
    return { type: "background.updated", id, status: "cancelled", title };
  }
  const error = stringField(update, "error") ?? stringField(snapshot ?? {}, "error");
  const exit = numberField(snapshot ?? {}, "exit_code") ?? numberField(snapshot ?? {}, "exitCode");
  const status: "completed" | "failed" | "cancelled" =
    error || (exit != null && exit !== 0) ? "failed" : "completed";
  return {
    type: "background.updated",
    id,
    status,
    title,
    detail: error ?? (exit != null ? `exit ${exit}` : undefined),
  };
}

function hashId(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function promptIndexFromUpdate(
  update: Record<string, unknown>,
  outer?: Record<string, unknown> | null,
): Extract<HarnessEvent, { type: "prompt.index" }> | null {
  const index =
    numberField(asRecord(update._meta) ?? {}, "promptIndex") ??
    numberField(asRecord(update._meta) ?? {}, "prompt_index") ??
    numberField(update, "promptIndex") ??
    numberField(update, "prompt_index") ??
    numberField(asRecord(outer?._meta) ?? {}, "promptIndex") ??
    numberField(asRecord(outer?._meta) ?? {}, "prompt_index");
  if (index == null) return null;
  return { type: "prompt.index", index };
}

function sessionSummaryText(
  update: Record<string, unknown>,
  outer?: Record<string, unknown> | null,
): string | null {
  const candidates = [
    stringField(update, "summary"),
    stringField(update, "text"),
    stringField(update, "message"),
    stringField(update, "title"),
    textFromContent(update.content ?? update.summary, "\n"),
    stringField(asRecord(outer) ?? {}, "summary"),
  ];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return trimmed.startsWith("Summary") ? trimmed : `Summary: ${trimmed}`;
    }
  }
  return null;
}

export function sessionIdFromResult(result: unknown): string | undefined {
  const rec = asRecord(result);
  const id = rec?.sessionId ?? rec?.session_id ?? rec?.id;
  return typeof id === "string" && id.trim() ? id.trim() : undefined;
}

export function contextWindowFromSetup(result: unknown): number | undefined {
  const models = [
    ...modelsFromSessionNew(result),
    ...modelsFromInitialize(result),
  ];
  const current = currentModelId(result);
  const match = models.find((model) => model.nativeId === current) ?? models[0];
  return match?.contextWindow;
}

export function currentModelId(result: unknown): string | undefined {
  const rec = asRecord(result);
  const models = asRecord(rec?.models);
  const meta = asRecord(rec?._meta);
  const state = asRecord(meta?.modelState);
  return (
    stringField(models ?? {}, "currentModelId") ??
    stringField(state ?? {}, "currentModelId") ??
    stringField(meta ?? {}, "currentModelId")
  );
}

export function modelsFromInitialize(result: unknown): AgentModel[] {
  const rec = asRecord(result);
  const meta = asRecord(rec?._meta);
  const state = asRecord(meta?.modelState);
  return modelsFromAvailable(state?.availableModels ?? rec?.availableModels);
}

export function modelsFromSessionNew(result: unknown): AgentModel[] {
  const rec = asRecord(result);
  const models = asRecord(rec?.models);
  return modelsFromAvailable(
    models?.availableModels ?? asRecord(rec?._meta)?.availableModels,
  );
}

export function modelsFromGrokModelsOutput(stdout: string): AgentModel[] {
  const models: AgentModel[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").trim();
    const match = /^[*+\-]\s+(\S+)/.exec(line);
    if (!match) continue;
    const nativeId = match[1].trim();
    if (!nativeId) continue;
    // CLI lists ids only. Prefer ACP names via mergeGrokCatalogs when both run.
    models.push(modelFromNative(nativeId, nativeId));
  }
  return uniqueGrokModels(models);
}

/** CLI decides membership; ACP supplies display names, context, and efforts. */
export function mergeGrokCatalogs(
  fromCli: AgentModel[],
  fromAcp: AgentModel[],
): AgentModel[] {
  if (fromCli.length === 0) return fromAcp;
  if (fromAcp.length === 0) return fromCli;
  const rich = new Map(
    fromAcp.map((model) => [model.nativeId ?? nativeId(model.id), model]),
  );
  return fromCli.map((model) => {
    const key = model.nativeId ?? nativeId(model.id);
    return rich.get(key) ?? model;
  });
}

export function fallbackGrokModels(): AgentModel[] {
  return [
    modelFromNative("grok-4.6", "Grok 4.6", {
      contextWindow: 500_000,
      efforts: [
        { value: "xhigh", label: "Extra High" },
        { value: "high", label: "High", default: true },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
      ],
    }),
    modelFromNative("grok-4.5", "Grok 4.5", {
      contextWindow: 500_000,
      efforts: [
        { value: "high", label: "High", default: true },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
      ],
    }),
  ];
}

function modelsFromAvailable(raw: unknown): AgentModel[] {
  if (!Array.isArray(raw)) return [];
  const models: AgentModel[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    if (!rec) continue;
    const nativeId = String(
      rec.modelId ?? rec.model_id ?? rec.id ?? rec.value ?? "",
    ).trim();
    if (!nativeId) continue;
    const name = String(rec.name ?? rec.displayName ?? nativeId).trim();
    const meta = asRecord(rec._meta) ?? rec;
    const window =
      numberField(meta, "totalContextTokens") ??
      numberField(meta, "contextWindow") ??
      numberField(rec, "contextWindow");
    const efforts = reasoningEfforts(meta);
    models.push(
      modelFromNative(nativeId, name || displayName(nativeId), {
        contextWindow: window,
        efforts,
        defaultEffort: stringField(meta, "reasoningEffort"),
      }),
    );
  }
  return uniqueGrokModels(models);
}

function modelFromNative(
  nativeId: string,
  name: string,
  extra?: {
    contextWindow?: number;
    efforts?: Array<ModelSettingChoice & { default?: boolean }>;
    defaultEffort?: string;
  },
): AgentModel {
  const efforts = extra?.efforts ?? [];
  const settings =
    efforts.length > 0
      ? [
          effortSetting(
            efforts,
            extra?.defaultEffort ??
              efforts.find((item) => item.default)?.value ??
              efforts[0]?.value,
          ),
        ]
      : undefined;
  return {
    id: `grok:${nativeId}`,
    harness: "grok",
    name,
    nativeId,
    ...(settings ? { settings } : {}),
    ...(extra?.contextWindow ? { contextWindow: extra.contextWindow } : {}),
  };
}

function effortSetting(
  options: ModelSettingChoice[],
  value?: string,
): ModelSetting {
  return {
    id: "effort",
    label: "Reasoning",
    kind: "select",
    value:
      value && options.some((item) => item.value === value)
        ? value
        : (options[0]?.value ?? "high"),
    options: options.map((item) => ({
      value: item.value,
      label: EFFORT_LABELS[item.value] ?? item.label,
    })),
  };
}

function reasoningEfforts(
  meta: Record<string, unknown>,
): Array<ModelSettingChoice & { default?: boolean }> {
  const raw = meta.reasoningEfforts ?? meta.reasoning_efforts;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const rec = asRecord(item);
    const value = String(rec?.value ?? rec?.id ?? "").trim();
    if (!value) return [];
    const label = String(rec?.label ?? EFFORT_LABELS[value] ?? value)
      .replace(/\s+Effort$/i, "")
      .trim();
    return [
      {
        value,
        label,
        default: rec?.default === true,
      },
    ];
  });
}

function grokToolFields(
  update: Record<string, unknown>,
  tool: Record<string, unknown>,
): {
  kind?: string;
  title?: string;
  path?: string;
  command?: string;
  query?: string;
  callId?: string;
  input?: Record<string, unknown>;
} {
  const meta = nestedMeta(update, "x.ai/tool") ?? nestedMeta(tool, "x.ai/tool");
  const input =
    asRecord(meta?.input) ??
    asRecord(update.rawInput) ??
    asRecord(update.raw_input) ??
    asRecord(tool.rawInput) ??
    asRecord(tool.raw_input) ??
    asRecord(update.input) ??
    asRecord(tool.input);
  const variant = String(input?.variant ?? meta?.name ?? "").toLowerCase();
  const variantKey = variant.replace(/[^a-z0-9]+/g, "");
  return {
    kind:
      stringField(meta ?? {}, "kind") ??
      VARIANT_KIND[variantKey] ??
      VARIANT_KIND[variant],
    title:
      stringField(meta ?? {}, "label") ??
      VARIANT_TITLE[variantKey] ??
      VARIANT_TITLE[variant] ??
      stringField(update, "title") ??
      stringField(tool, "title"),
    path:
      stringField(input ?? {}, "path") ??
      stringField(input ?? {}, "absolute_path") ??
      stringField(input ?? {}, "file_path"),
    command: stringField(input ?? {}, "command"),
    query:
      stringField(input ?? {}, "query") ??
      stringField(input ?? {}, "pattern") ??
      stringField(input ?? {}, "search"),
    callId:
      stringField(update, "toolCallId") ??
      stringField(update, "tool_call_id") ??
      stringField(tool, "toolCallId") ??
      stringField(tool, "tool_call_id"),
    input: input ?? undefined,
  };
}

function nestedMeta(
  rec: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const meta = asRecord(rec._meta);
  return meta ? asRecord(meta[key]) : null;
}

function mergePreview(
  preview: ToolPreview | undefined,
  path?: string,
  query?: string,
  kind?: string,
): ToolPreview | undefined {
  if (query && (!preview || preview.kind === "search" || !preview.path)) {
    return { kind: "search", ...(preview ?? {}), query };
  }
  if (!path) return preview;
  const fileName = basename(path);
  if (preview) {
    return {
      ...preview,
      path: preview.path ?? path,
      fileName: preview.fileName ?? fileName,
    };
  }
  return { kind: previewKind(kind), path, fileName };
}

function previewKind(kind?: string): ToolPreview["kind"] {
  const key = (kind ?? "").toLowerCase();
  if (key === "execute" || key === "shell") return "shell";
  if (key === "search" || key === "fetch") return "search";
  if (key === "edit" || key === "write") return "write";
  return "read";
}

function usageFromUpdate(update: Record<string, unknown>): HarnessEvent | null {
  const usage =
    asRecord(update.usage) ??
    asRecord(update.tokenUsage) ??
    asRecord(update.token_usage) ??
    (hasUsageFields(update) ? update : null);
  if (!usage) return null;
  const used =
    numberField(usage, "totalTokens") ??
    numberField(usage, "used") ??
    numberField(usage, "usedTokens") ??
    numberField(usage, "used_tokens") ??
    sumNumbers(usage, [
      "inputTokens",
      "outputTokens",
      "input_tokens",
      "output_tokens",
    ]);
  const window =
    numberField(usage, "window") ??
    numberField(usage, "contextWindow") ??
    numberField(usage, "context_window") ??
    numberField(usage, "maxTokens");
  if (used == null && window == null) return null;
  return {
    type: "context",
    used: used ?? undefined,
    window: window ?? undefined,
  };
}

function hasUsageFields(rec: Record<string, unknown>): boolean {
  return (
    numberField(rec, "used") != null ||
    numberField(rec, "totalTokens") != null ||
    numberField(rec, "inputTokens") != null
  );
}

function planEvent(update: Record<string, unknown>): HarnessEvent | null {
  const entries = update.entries ?? update.plan;
  if (Array.isArray(entries)) {
    const items = entries.flatMap((item) => {
      const rec = asRecord(item);
      if (!rec) return [];
      const content = String(rec.content ?? rec.text ?? rec.title ?? "").trim();
      if (!content) return [];
      return [
        {
          text: content,
          status: normalizeTaskListStatus(rec.status),
        },
      ];
    });
    return { type: "tasks.updated", items };
  }
  if (typeof update.text === "string" && update.text.trim()) {
    return { type: "plan", text: update.text };
  }
  return null;
}

function toolLabel(rec: Record<string, unknown>): string | undefined {
  return (
    humanField(rec, "title") ??
    humanField(rec, "name") ??
    humanField(rec, "toolName") ??
    humanField(rec, "tool_name")
  );
}

function toolDetail(
  update: Record<string, unknown>,
  tool: Record<string, unknown>,
): string | undefined {
  const content =
    textFromContent(update.content, "\n") ||
    textFromContent(tool.content, "\n");
  if (content.trim()) return cap(content);
  const output = update.rawOutput ?? tool.rawOutput;
  if (typeof output === "string" && output.trim()) return cap(output);
  const outputText = textFromContent(output);
  if (outputText.trim()) return cap(outputText);
  const concise = stringField(asRecord(output) ?? {}, "content_concise");
  return concise ? cap(concise) : undefined;
}

function kindFromName(name?: string): string | undefined {
  if (!name) return undefined;
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return VARIANT_KIND[key] ?? VARIANT_KIND[name.toLowerCase()];
}

function humanizeToolName(name: string): string {
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const known = VARIANT_TITLE[key] ?? VARIANT_TITLE[name.toLowerCase()];
  if (known) return known;
  const cleaned = name.replace(/[_-]+/g, " ").trim();
  return cleaned ? cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase()) : name;
}

/** Parse `_x.ai/rewind/points` (snake_case or camelCase). */
export function parseGrokRewindPoints(raw: unknown): GrokRewindPoint[] {
  const rec = asRecord(raw);
  const list = Array.isArray(rec?.rewind_points)
    ? rec.rewind_points
    : Array.isArray(rec?.rewindPoints)
      ? rec.rewindPoints
      : Array.isArray(raw)
        ? raw
        : [];
  const points: GrokRewindPoint[] = [];
  for (const entry of list) {
    const row = asRecord(entry);
    if (!row) continue;
    const promptIndex =
      numberField(row, "promptIndex") ??
      numberField(row, "prompt_index") ??
      numberField(row, "id");
    if (promptIndex == null || !Number.isFinite(promptIndex) || promptIndex < 0) {
      continue;
    }
    const promptPreview =
      stringField(row, "promptPreview") ??
      stringField(row, "prompt_preview") ??
      stringField(row, "userMessage") ??
      stringField(row, "user_message");
    const createdAt =
      stringField(row, "createdAt") ?? stringField(row, "created_at");
    const numFileSnapshots =
      numberField(row, "numFileSnapshots") ??
      numberField(row, "num_file_snapshots");
    const hasFileChanges =
      typeof row.hasFileChanges === "boolean"
        ? row.hasFileChanges
        : typeof row.has_file_changes === "boolean"
          ? row.has_file_changes
          : undefined;
    points.push({
      promptIndex,
      ...(promptPreview ? { promptPreview } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(numFileSnapshots != null ? { numFileSnapshots } : {}),
      ...(hasFileChanges != null ? { hasFileChanges } : {}),
    });
  }
  return points.sort((a, b) => a.promptIndex - b.promptIndex);
}

/**
 * Prefer provider rewind points when picking a target index.
 * Matches preview text when the transcript ordinal may drift from Grok's index.
 */
export function resolveGrokRewindTarget(input: {
  preferredIndex: number | null;
  points: GrokRewindPoint[];
  removedUserText?: string;
}): number | null {
  const { preferredIndex, points } = input;
  if (points.length === 0) return preferredIndex;

  const needle = input.removedUserText?.trim();
  if (needle) {
    const byPreview = points.find((point) => {
      const preview = point.promptPreview?.trim();
      if (!preview) return false;
      return (
        preview === needle ||
        needle.startsWith(preview) ||
        preview.startsWith(needle)
      );
    });
    if (byPreview) return byPreview.promptIndex;
  }

  if (preferredIndex != null) {
    if (points.some((point) => point.promptIndex === preferredIndex)) {
      return preferredIndex;
    }
    return preferredIndex;
  }

  return points[0]?.promptIndex ?? null;
}

function uniqueGrokModels(models: AgentModel[]): AgentModel[] {
  const seen = new Set<string>();
  const out: AgentModel[] = [];
  for (const model of models) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    out.push(model);
  }
  return out;
}

function displayName(nativeId: string): string {
  return nativeId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function nativeId(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) return "";
  const colon = trimmed.indexOf(":");
  return colon >= 0 ? trimmed.slice(colon + 1) : trimmed;
}

function cap(value: string, max = 8_000): string {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…`;
}

function pickOption(optionIds: string[], preferred: string[]): string | null {
  for (const id of preferred) {
    if (optionIds.includes(id)) return id;
  }
  return null;
}

function humanField(
  rec: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = stringField(rec, key);
  if (!value || looksLikeCallId(value)) return undefined;
  return value;
}

function looksLikeCallId(value: string): boolean {
  const text = value.trim();
  return (
    /^(call[-_]?|tool[-_])[a-z0-9_-]+$/i.test(text) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
  );
}

function textFromContent(content: unknown, separator = ""): string {
  if (typeof content === "string") return content;
  const rec = asRecord(content);
  if (rec && typeof rec.text === "string") return rec.text;
  if (rec && rec.content != null)
    return textFromContent(rec.content, separator);
  if (Array.isArray(content)) {
    return content
      .map((item) => textFromContent(item, separator))
      .filter(Boolean)
      .join(separator);
  }
  return "";
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function stringField(
  rec: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = rec[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberField(
  rec: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = rec[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() &&
    Number.isFinite(Number(value))
  ) {
    return Number(value);
  }
  return undefined;
}

function sumNumbers(
  rec: Record<string, unknown>,
  keys: string[],
): number | undefined {
  let total = 0;
  let found = false;
  for (const key of keys) {
    const value = numberField(rec, key);
    if (value == null) continue;
    total += value;
    found = true;
  }
  return found ? total : undefined;
}
