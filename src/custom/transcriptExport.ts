import type { Block, Session } from "../lib/session";
import { HARNESS_TITLE } from "../lib/session";

function roleHeading(role: Block["role"]): string | null {
  switch (role) {
    case "user":
      return "User";
    case "assistant":
      return "Assistant";
    case "reasoning":
      return "Thinking";
    case "system":
      return "System";
    case "plan":
      return "Plan";
    case "handoff":
      return "Handoff";
    case "tasks":
      return "Tasks";
    case "tool":
    case "approval":
      return null;
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

/** Markdown dump of a session transcript for docs / bug reports. */
export function sessionTranscriptMarkdown(session: Session): string {
  const lines: string[] = [
    `# ${session.title}`,
    "",
    `- Provider: ${HARNESS_TITLE[session.harness]}`,
    `- Model: ${session.model}`,
    `- CWD: ${session.cwd}`,
    "",
  ];
  for (const block of session.blocks) {
    const heading = roleHeading(block.role);
    if (!heading) continue;
    const text = block.text.trim();
    if (!text && block.role !== "handoff") continue;
    lines.push(`## ${heading}`);
    lines.push("");
    lines.push(text || `_${heading}_`);
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
