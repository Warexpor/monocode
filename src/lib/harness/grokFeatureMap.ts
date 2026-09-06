/**
 * Grok Build feature → MonoCode surface map.
 * Source of truth: xai-org/grok-build user guide + ACP shell extensions.
 * Keep this aligned when wiring new host UI.
 */
export type GrokFeatureCoverage =
  | "ui"
  | "harness"
  | "slash"
  | "settings"
  | "skip-tui"
  | "partial"
  | "missing";

export type GrokFeature = {
  id: string;
  title: string;
  coverage: GrokFeatureCoverage;
  notes: string;
};

export const GROK_FEATURE_MAP: GrokFeature[] = [
  {
    id: "live-turns",
    title: "Live ACP turns",
    coverage: "ui",
    notes: "AgentTranscript + Composer",
  },
  {
    id: "reasoning",
    title: "Thought stream",
    coverage: "ui",
    notes: "reasoning blocks",
  },
  {
    id: "tools",
    title: "Tool calls (read/edit/shell/search/web/lsp/…)",
    coverage: "ui",
    notes: "Activity folding + previews",
  },
  {
    id: "approvals",
    title: "Permission prompts",
    coverage: "ui",
    notes: "Inline + toasts; runtime modes",
  },
  {
    id: "ask-user",
    title: "ask_user_question",
    coverage: "ui",
    notes: "QuestionForm",
  },
  {
    id: "plan-mode",
    title: "Plan mode + exit_plan_mode",
    coverage: "ui",
    notes: "Plan card + Build",
  },
  {
    id: "tasks-todo",
    title: "Todo / plan task list",
    coverage: "ui",
    notes: "TaskListPreview",
  },
  {
    id: "subagents",
    title: "Subagent spawn/progress/finish",
    coverage: "ui",
    notes: "AgentActivityPanel",
  },
  {
    id: "background-tasks",
    title: "Background shell + monitor + scheduler",
    coverage: "ui",
    notes: "AgentActivityPanel",
  },
  {
    id: "follow-ups",
    title: "x.ai/follow_ups chips",
    coverage: "ui",
    notes: "FollowUpChips",
  },
  {
    id: "slash-commands",
    title: "Shell builtins + skills + workflows as /",
    coverage: "slash",
    notes: "ACP available_commands_update + SkillPicker",
  },
  {
    id: "btw",
    title: "Mid-turn /btw aside",
    coverage: "ui",
    notes: "Side panel while busy; x.ai/btw; dismissible",
  },
  {
    id: "compact",
    title: "Manual + auto compact",
    coverage: "ui",
    notes: "ContextMeter + status lines",
  },
  {
    id: "rewind",
    title: "Conversation rewind",
    coverage: "ui",
    notes: "Edit/resend uses rewind points + execute; status line on success",
  },
  {
    id: "models-effort",
    title: "Model + reasoning effort",
    coverage: "ui",
    notes: "ModelPicker / ModelSettings",
  },
  {
    id: "attachments",
    title: "Image attachments",
    coverage: "ui",
    notes: "Composer attach",
  },
  {
    id: "context-usage",
    title: "Context meter",
    coverage: "ui",
    notes: "ContextMeter",
  },
  {
    id: "skills-files",
    title: ".grok/skills discovery",
    coverage: "slash",
    notes: "Native catalog + SkillPicker create hint + Settings note",
  },
  {
    id: "titles-git-text",
    title: "Titles / commit / PR / branch text",
    coverage: "ui",
    notes: "grokText side session",
  },
  {
    id: "mcp-elicit",
    title: "MCP elicitation",
    coverage: "ui",
    notes: "URL/form prompts via QuestionForm; Continue/Decline/Cancel",
  },
  {
    id: "mcp-manage",
    title: "MCP server management",
    coverage: "settings",
    notes: "Providers note: ~/.grok + grok mcp; no OAuth UI",
  },
  {
    id: "plugins-hooks",
    title: "Plugins / hooks / marketplace",
    coverage: "slash",
    notes: "Via advertised slash; no settings modal",
  },
  {
    id: "workflows",
    title: "Workflows + deep-research + goals",
    coverage: "ui",
    notes: "Slash launch + workflow_updated/goal_updated in Activity panel",
  },
  {
    id: "memory",
    title: "Memory browse/flush/dream",
    coverage: "slash",
    notes: "Slash when gated on; status on flush/dream notifications",
  },
  {
    id: "media-gen",
    title: "Image / video generation",
    coverage: "ui",
    notes: "Tool titles + inline media preview when path/URL present",
  },
  {
    id: "session-fork",
    title: "Session fork / worktrees",
    coverage: "slash",
    notes: "Advertised /fork and worktree slash; MonoCode tabs for multi-session",
  },
  {
    id: "diff-review",
    title: "Diff review notification",
    coverage: "ui",
    notes: "Status cue + SessionReview for workspace diffs",
  },
  {
    id: "usage-billing",
    title: "Usage / privacy / login",
    coverage: "settings",
    notes: "Providers row + CLI; no /usage pane",
  },
  {
    id: "sandbox",
    title: "Sandbox profiles",
    coverage: "settings",
    notes: "Documented under Grok Providers (~/.grok sandbox.toml)",
  },
  {
    id: "goals",
    title: "Autonomous goals progress",
    coverage: "ui",
    notes: "goal_updated → Activity panel + status",
  },
  {
    id: "steer",
    title: "Mid-turn steer",
    coverage: "skip-tui",
    notes: "Grok cannot steer; follow-ups queue (btw excepted)",
  },
  {
    id: "theme-statusline-dashboard",
    title: "TUI theme / status line / agent dashboard",
    coverage: "skip-tui",
    notes: "Pager-only chrome",
  },
];

export function grokFeaturesByCoverage(
  coverage: GrokFeatureCoverage,
): GrokFeature[] {
  return GROK_FEATURE_MAP.filter((feature) => feature.coverage === coverage);
}
