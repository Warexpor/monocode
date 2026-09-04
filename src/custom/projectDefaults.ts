import type { HarnessId } from "../lib/session";
import { HARNESSES } from "../lib/session";
import { normalizeProjectPath } from "../lib/recents";

const KEY = "monocode.projectDefaults";

export type ProjectDefault = {
  harness: HarnessId;
  model: string;
};

type DefaultsMap = Record<string, ProjectDefault>;

function readMap(): DefaultsMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: DefaultsMap = {};
    for (const [path, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const rec = value as Record<string, unknown>;
      const harness = rec.harness;
      const model = rec.model;
      if (
        typeof harness === "string" &&
        (HARNESSES as readonly string[]).includes(harness) &&
        typeof model === "string" &&
        model.trim()
      ) {
        out[normalizeProjectPath(path)] = {
          harness: harness as HarnessId,
          model: model.trim(),
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: DefaultsMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function loadProjectDefault(cwd: string): ProjectDefault | undefined {
  if (!cwd.trim()) return undefined;
  return readMap()[normalizeProjectPath(cwd)];
}

export function saveProjectDefault(
  cwd: string,
  harness: HarnessId,
  model: string,
): void {
  const path = normalizeProjectPath(cwd);
  if (!path || path === "/" || path === "~") return;
  const map = readMap();
  map[path] = { harness, model };
  writeMap(map);
}

export function resetProjectDefaults(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
