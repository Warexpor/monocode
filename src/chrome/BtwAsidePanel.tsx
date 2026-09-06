import { Loader, MessageSquare, X } from "./icons";
import { AgentMarkdown } from "../surfaces/AgentMarkdown";
import type { BtwAside } from "../lib/session";

type Props = {
  aside: BtwAside;
  cwd?: string;
  onDismiss: () => void;
  onOpenFile?: (path: string) => void;
};

export function BtwAsidePanel({ aside, cwd, onDismiss, onOpenFile }: Props) {
  return (
    <aside
      aria-label="btw aside"
      className="flex h-full w-[min(100%,22rem)] shrink-0 flex-col border-l border-content/10 bg-content/[0.025]"
    >
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-content/10 px-2.5">
        <MessageSquare
          className="size-3.5 shrink-0 text-content/45"
          strokeWidth={1.75}
        />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-medium text-content/80">
          btw
        </span>
        <button
          type="button"
          title="Dismiss"
          aria-label="Dismiss btw aside"
          onClick={onDismiss}
          className="grid size-5 shrink-0 place-items-center rounded text-content/45 hover:bg-content/10 hover:text-content"
        >
          <X className="size-3" strokeWidth={1.75} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        <p className="mb-3 font-sans text-[12.5px] leading-4.5 text-content/55">
          {aside.question}
        </p>
        {aside.status === "pending" ? (
          <div className="flex items-center gap-2 font-mono text-[11.5px] text-content/50">
            <Loader className="size-3.5 animate-spin" strokeWidth={2} />
            Asking aside…
          </div>
        ) : null}
        {aside.status === "error" ? (
          <p className="font-sans text-[12.5px] leading-4.5 text-rose-300/90">
            {aside.error?.trim() || "btw failed"}
          </p>
        ) : null}
        {aside.status === "done" && aside.answer ? (
          <div className="text-[12.5px] leading-4.5 text-content/85">
            <AgentMarkdown text={aside.answer} cwd={cwd} onOpenFile={onOpenFile} />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
