import {
  DEFAULT_RUNTIME_MODE,
  type RuntimeMode,
  RUNTIME_MODES,
} from "../lib/session";

const KEY = "monocode.preferredRuntimeMode";

export function loadPreferredRuntimeMode(): RuntimeMode {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw && (RUNTIME_MODES as readonly string[]).includes(raw)) {
      return raw as RuntimeMode;
    }
  } catch {
    // ignore
  }
  return DEFAULT_RUNTIME_MODE;
}

export function savePreferredRuntimeMode(mode: RuntimeMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // private mode / quota
  }
}

export function resetPreferredRuntimeMode(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
