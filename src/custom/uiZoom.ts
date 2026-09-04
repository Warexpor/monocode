import { getCurrentWebview } from "@tauri-apps/api/webview";

const UI_ZOOM_KEY = "monocode.uiZoom";

export const UI_ZOOM_LEVELS = [0.75, 0.9, 1, 1.1, 1.25, 1.5] as const;
export const UI_ZOOM_DEFAULT = 1;

export const UI_ZOOM_CHANGE_EVENT = "monocode:uizoomchange";

function clampToLevel(value: number): number {
  let best = UI_ZOOM_DEFAULT;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const level of UI_ZOOM_LEVELS) {
    const dist = Math.abs(level - value);
    if (dist < bestDist) {
      best = level;
      bestDist = dist;
    }
  }
  return best;
}

export function loadUiZoom(): number {
  try {
    const raw = localStorage.getItem(UI_ZOOM_KEY);
    if (raw == null) return UI_ZOOM_DEFAULT;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return UI_ZOOM_DEFAULT;
    return clampToLevel(parsed);
  } catch {
    return UI_ZOOM_DEFAULT;
  }
}

export function saveUiZoom(value: number): number {
  const next = clampToLevel(value);
  try {
    localStorage.setItem(UI_ZOOM_KEY, String(next));
  } catch {
    // private mode / quota
  }
  return next;
}

export async function applyUiZoom(factor: number): Promise<number> {
  const next = saveUiZoom(factor);
  try {
    await getCurrentWebview().setZoom(next);
  } catch {
    // browser preview / missing webview API
  }
  window.dispatchEvent(
    new CustomEvent(UI_ZOOM_CHANGE_EVENT, { detail: next }),
  );
  return next;
}

export function nextZoomIn(current: number = loadUiZoom()): number {
  for (const level of UI_ZOOM_LEVELS) {
    if (level > current + 1e-9) return level;
  }
  return UI_ZOOM_LEVELS[UI_ZOOM_LEVELS.length - 1] ?? current;
}

export function nextZoomOut(current: number = loadUiZoom()): number {
  for (let i = UI_ZOOM_LEVELS.length - 1; i >= 0; i -= 1) {
    const level = UI_ZOOM_LEVELS[i]!;
    if (level < current - 1e-9) return level;
  }
  return UI_ZOOM_LEVELS[0] ?? current;
}

export async function zoomIn(): Promise<number> {
  return applyUiZoom(nextZoomIn());
}

export async function zoomOut(): Promise<number> {
  return applyUiZoom(nextZoomOut());
}

export async function resetUiZoom(): Promise<number> {
  return applyUiZoom(UI_ZOOM_DEFAULT);
}

/** Boot: restore last zoom onto the live webview. */
export function initUiZoom(): void {
  void applyUiZoom(loadUiZoom());
}

/**
 * Ctrl/Cmd + / - / 0 (and numpad). Returns true when the chord was handled.
 * Skip when the event is already claimed or when a terminal should keep Ctrl.
 */
export function isUiZoomChord(event: KeyboardEvent): boolean {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
    return false;
  }
  const key = event.key;
  const code = event.code;
  return (
    key === "=" ||
    key === "+" ||
    key === "-" ||
    key === "_" ||
    key === "0" ||
    code === "NumpadAdd" ||
    code === "NumpadSubtract" ||
    code === "Numpad0" ||
    code === "Digit0" ||
    code === "Equal" ||
    code === "Minus"
  );
}

export function uiZoomActionFromEvent(
  event: KeyboardEvent,
): "in" | "out" | "reset" | null {
  if (!isUiZoomChord(event)) return null;
  const key = event.key;
  const code = event.code;
  if (
    key === "0" ||
    code === "Numpad0" ||
    code === "Digit0"
  ) {
    return "reset";
  }
  if (
    key === "-" ||
    key === "_" ||
    code === "NumpadSubtract" ||
    code === "Minus"
  ) {
    return "out";
  }
  if (
    key === "=" ||
    key === "+" ||
    code === "NumpadAdd" ||
    code === "Equal"
  ) {
    return "in";
  }
  return null;
}

export async function handleUiZoomChord(event: KeyboardEvent): Promise<boolean> {
  const action = uiZoomActionFromEvent(event);
  if (!action) return false;
  if (action === "in") await zoomIn();
  else if (action === "out") await zoomOut();
  else await resetUiZoom();
  return true;
}
