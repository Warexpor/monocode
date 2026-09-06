import { Bot, Loader, Terminal } from "./icons";
import type {
  SessionAgent,
  SessionBackgroundTask,
} from "../lib/session";

type Props = {
  agents?: SessionAgent[];
  backgroundTasks?: SessionBackgroundTask[];
};

export function AgentActivityPanel({ agents = [], backgroundTasks = [] }: Props) {
  const visibleAgents = agents.filter(
    (agent) => agent.status === "running" || agent.status === "failed",
  );
  const visibleTasks = backgroundTasks.filter(
    (task) => task.status === "running" || task.status === "failed",
  );
  if (visibleAgents.length === 0 && visibleTasks.length === 0) return null;

  return (
    <section
      aria-label="Agent activity"
      className="mb-2 overflow-hidden rounded-[10px] border border-content/10 bg-content/[0.035]"
    >
      <div className="border-b border-content/8 px-2.5 py-2">
        <h3 className="font-mono text-[12px] font-medium text-content/85">
          Activity
        </h3>
      </div>
      <ul className="py-1">
        {visibleAgents.map((agent) => (
          <li
            key={`agent:${agent.id}`}
            className="flex min-w-0 items-start gap-2.5 px-2.5 py-1.5"
          >
            <span className="mt-px grid size-4 shrink-0 place-items-center text-violet-300">
              {agent.status === "running" ? (
                <Loader className="size-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <Bot className="size-3.5" strokeWidth={1.75} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-sans text-[12.5px] leading-4.5 text-content/85">
                {agent.title}
              </div>
              <div className="truncate font-mono text-[10.5px] text-content/45">
                {[
                  agent.kind,
                  agent.model,
                  agent.detail,
                  agent.status === "running" ? "running" : agent.status,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          </li>
        ))}
        {visibleTasks.map((task) => (
          <li
            key={`task:${task.id}`}
            className="flex min-w-0 items-start gap-2.5 px-2.5 py-1.5"
          >
            <span className="mt-px grid size-4 shrink-0 place-items-center text-sky-300">
              {task.status === "running" ? (
                <Loader className="size-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <Terminal className="size-3.5" strokeWidth={1.75} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-sans text-[12.5px] leading-4.5 text-content/85">
                {task.title}
              </div>
              {task.detail ? (
                <div className="truncate font-mono text-[10.5px] text-content/45">
                  {task.detail}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
