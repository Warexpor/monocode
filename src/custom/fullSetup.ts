import { invoke } from "@tauri-apps/api/core";
import { IS_WIN } from "../lib/platform";

export type FullSetupStatus = {
  supported: boolean;
  nodeOk: boolean;
  npmOk: boolean;
  nodeVersion: string | null;
  npmVersion: string | null;
  grokOk: boolean;
  grokVersion: string | null;
  grokPath: string | null;
  ocxOk: boolean;
  ocxVersion: string | null;
  ocxPath: string | null;
  ocxHealthy: boolean;
  keyPresent: boolean;
  exaMcpPresent: boolean;
  hint: string | null;
};

export type FullSetupCatalogModel = {
  id: string;
  name: string;
  free: boolean;
};

export type FullSetupCatalogs = {
  zenFree: FullSetupCatalogModel[];
  go: FullSetupCatalogModel[];
};

export type FullSetupApplyResult = {
  log: string[];
  ocxModelCount: number;
  exaMcpPresent: boolean;
  ocxHealthy: boolean;
};

const COMPLETE_KEY = "monocode.fullSetupComplete";

export function isFullSetupSupported(): boolean {
  return IS_WIN;
}

export function loadFullSetupComplete(): boolean {
  try {
    return localStorage.getItem(COMPLETE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveFullSetupComplete(done: boolean): void {
  try {
    if (done) localStorage.setItem(COMPLETE_KEY, "1");
    else localStorage.removeItem(COMPLETE_KEY);
  } catch {
    /* ignore */
  }
}

export function fullSetupStatus(): Promise<FullSetupStatus> {
  return invoke<FullSetupStatus>("full_setup_status");
}

export function fullSetupInstallGrok(): Promise<string> {
  return invoke<string>("full_setup_install_grok");
}

export function fullSetupInstallOpenCodex(): Promise<string> {
  return invoke<string>("full_setup_install_opencodex");
}

export function fullSetupSetKey(key: string): Promise<FullSetupStatus> {
  return invoke<FullSetupStatus>("full_setup_set_key", { key });
}

export function fullSetupFetchCatalogs(): Promise<FullSetupCatalogs> {
  return invoke<FullSetupCatalogs>("full_setup_fetch_catalogs");
}

export function fullSetupApply(input: {
  goModelIds: string[];
  enableExa: boolean;
}): Promise<FullSetupApplyResult> {
  return invoke<FullSetupApplyResult>("full_setup_apply", {
    args: {
      goModelIds: input.goModelIds,
      enableExa: input.enableExa,
    },
  });
}

export function recoveryHint(step: string, error: string): string {
  const msg = error.trim();
  if (
    /npm not found|node/i.test(msg) ||
    (step === "prereq" && /not found|Install Node/i.test(msg))
  ) {
    return "Install Node.js LTS from https://nodejs.org, then reopen MonoCode.";
  }
  if (/grok/i.test(step) || /install\.ps1|x\.ai\/cli/i.test(msg)) {
    return "If grok still is not found, restart MonoCode so PATH picks up ~/.grok/bin.";
  }
  if (/opencodex|ocx|npm/i.test(step) || /@bitkyc08/i.test(msg)) {
    return "Confirm npm works in a terminal (`npm -v`), then retry OpenCodex install.";
  }
  if (/api key|401|403|Bearer|OpenCode/i.test(msg) || step === "key") {
    return "Create a key at https://opencode.ai/auth and paste it again.";
  }
  if (/opencodex|10100|ensure|start/i.test(msg) || step === "apply") {
    return "Try `ocx ensure` in a terminal. Full Setup needs loopback :10100.";
  }
  return "Copy the log above, fix the failing step, and resume Full Setup.";
}

/** Mirrors Rust `is_zen_free` for UI copy / tests. */
export function isZenFreeId(id: string): boolean {
  const lower = id.toLowerCase();
  return (
    lower.endsWith("-free") ||
    lower === "big-pickle" ||
    lower.endsWith("/big-pickle")
  );
}
