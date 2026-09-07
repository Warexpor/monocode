import { X } from "./icons";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLockOverscroll } from "../hooks/useLockOverscroll";
import { LAYER } from "../lib/layers";

export type ModalSize = "sm" | "md" | "lg";

const WIDTH: Record<ModalSize, string> = {
  sm: "w-[min(420px,calc(100vw-24px))]",
  md: "w-[min(560px,calc(100vw-24px))]",
  lg: "w-[min(720px,calc(100vw-24px))]",
};

const TOP: Record<ModalSize, string> = {
  sm: "top-[22%]",
  md: "top-[10%]",
  lg: "top-[6%]",
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => el.getClientRects().length > 0);
}

type Props = {
  onClose: () => void;
  title: string;
  description?: string;
  size?: ModalSize;
  /** Extra classes on the panel (fixed height, etc). */
  className?: string;
  /** When true: Close, Escape, and backdrop mousedown do nothing. */
  closeDisabled?: boolean;
  /** When true, description wraps instead of truncating. */
  descriptionMultiline?: boolean;
  children: ReactNode;
};

export function ModalPanel({
  onClose,
  title,
  description,
  size = "md",
  className,
  closeDisabled = false,
  descriptionMultiline = false,
  children,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const initialCloseDisabled = useRef(closeDisabled).current;
  const lockOverscroll = useLockOverscroll<HTMLDivElement>();
  const uid = useId();
  const titleId = `${uid}-title`;
  const descriptionId = description ? `${uid}-desc` : undefined;

  useEffect(() => {
    const body = bodyRef.current;
    const panel = panelRef.current;
    const inBody = body ? focusablesIn(body) : [];
    if (inBody[0]) {
      inBody[0].focus();
      return;
    }
    if (!initialCloseDisabled) {
      closeRef.current?.focus();
      return;
    }
    const inPanel = panel ? focusablesIn(panel) : [];
    inPanel[0]?.focus();
  }, [initialCloseDisabled]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (closeDisabled) return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = focusablesIn(panel);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, closeDisabled]);

  const setBodyRef = (node: HTMLDivElement | null) => {
    bodyRef.current = node;
    lockOverscroll(node);
  };

  return (
    <div
      className={`absolute left-1/2 ${TOP[size]} ${WIDTH[size]} -translate-x-1/2`}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={(event) => event.stopPropagation()}
        className={`flex flex-col overflow-hidden rounded-2xl border border-content/10 bg-background-base/55 shadow-2xl backdrop-blur-xl ${className ?? ""}`}
      >
        <header className="flex shrink-0 items-start gap-2 px-4 pt-3">
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id={titleId}
              className="text-2xl font-semibold leading-tight text-content"
            >
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className={`mt-0.5 text-[12px] leading-snug text-content/50 ${
                  descriptionMultiline ? "whitespace-normal" : "truncate"
                }`}
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            disabled={closeDisabled}
            onClick={onClose}
            className="grid size-7 shrink-0 place-items-center rounded-md text-content/45 hover:bg-content/8 hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40"
          >
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        </header>
        <div
          ref={setBodyRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-none"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function Modal(props: Props) {
  const closeDisabled = props.closeDisabled ?? false;
  return createPortal(
    <div className="mono-dialog fixed inset-0" style={{ zIndex: LAYER.dialog }}>
      <div
        className="absolute inset-0 bg-black/40"
        onMouseDown={closeDisabled ? undefined : props.onClose}
      />
      <ModalPanel {...props} />
    </div>,
    document.body,
  );
}
