import { useEffect, useRef } from "react";
import { MessageSquare } from "../chrome/icons";
import { OverlayNav } from "../chrome/TitleBar";
import { WindowControls } from "../chrome/WindowControls";
import type { ApprovalDecision } from "../lib/harness";
import { IS_MAC } from "../lib/platform";
import {
  sessionDisplayTitle,
  sessionWorkCwd,
  type Session,
} from "../lib/session";
import { AgentTranscript } from "./AgentTranscript";

type Props = {
  session: Session | null;
  besideRail?: boolean;
  onClose: () => void;
  onToggleSidebar?: () => void;
  onApproval?: (requestId: number, decision: ApprovalDecision) => void;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
  onOpenPlan?: (blockId: string) => void;
};

export function TranscriptOverlayView({
  session,
  besideRail = false,
  onClose,
  onToggleSidebar,
  onApproval,
  onOpenFile,
  onOpenDiff,
  onOpenPlan,
}: Props) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    // Bubble phase, not capture: popovers/dialogs inside the overlay handle
    // Escape in the capture phase and preventDefault it. Closing the whole
    // overlay must yield to dismissing whatever is open on top of it.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const title = session
    ? sessionDisplayTitle(session.title, session.harness)
    : "Transcript";
  const workCwd = session ? sessionWorkCwd(session) : undefined;

  return (
    <div
      role="region"
      aria-label="Agent transcript"
      data-app-transcript
      className="flex min-h-0 min-w-0 flex-1 flex-col text-content"
    >
      <div
        className="flex h-10 shrink-0 select-none items-center border-b border-content/10"
        data-tauri-drag-region="deep"
      >
        {IS_MAC && !besideRail ? <div className="w-[78px] shrink-0" /> : null}
        {besideRail ? null : (
          <OverlayNav onBack={onClose} onToggleSidebar={onToggleSidebar} />
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 text-[13px]">
          <MessageSquare
            className="size-3.5 shrink-0 text-content/45"
            strokeWidth={1.75}
          />
          <span className="min-w-0 truncate text-content" title={title}>
            {title}
          </span>
        </div>
        {IS_MAC ? null : <WindowControls />}
      </div>
      <div className="relative min-h-0 min-w-0 flex-1">
        {session ? (
          <AgentTranscript
            blocks={session.blocks}
            busy={!!session.busy}
            visible
            cwd={workCwd}
            harness={session.harness}
            model={session.model}
            pendingQuestion={!!session.pendingQuestion}
            forceShowReasoning
            onApproval={onApproval}
            onOpenFile={onOpenFile}
            onOpenDiff={onOpenDiff}
            onOpenPlan={onOpenPlan}
          />
        ) : (
          <p className="px-4 py-6 font-sans text-[13px] text-content/50">
            No active agent session to show.
          </p>
        )}
      </div>
    </div>
  );
}
