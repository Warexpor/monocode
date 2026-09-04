import { loadPreferredRuntimeMode } from "./preferredRuntimeMode";
import { loadProjectDefault } from "./projectDefaults";
import {
  newDefaultSession,
  newSession,
  type RuntimeMode,
  type Session,
} from "../lib/session";

/** New chat using per-project defaults + remembered access mode. */
export function createComfortSession(
  cwd = "~",
  runtimeMode?: RuntimeMode,
): Session {
  const mode = runtimeMode ?? loadPreferredRuntimeMode();
  const project = loadProjectDefault(cwd);
  if (project) {
    return newSession(project.harness, cwd, project.model, mode);
  }
  return newDefaultSession(cwd, mode);
}
