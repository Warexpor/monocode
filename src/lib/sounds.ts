import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { slash } from "./paths";

const KEY = "monocode.sounds";
const COMPLETION_KEY = "monocode.completionSound";
const COMPLETION_PATH_KEY = "monocode.completionSoundPath";

export const SOUNDS_DEFAULT = true;
export const COMPLETION_SOUND_DEFAULT = true;

/** Soft enough to sit in the background while a turn runs in another app. */
export const SOUNDS_VOLUME = 0.55;

export const SOUNDS_CHANGE_EVENT = "monocode:sounds-change";
export const COMPLETION_SOUND_CHANGE_EVENT = "monocode:completion-sound-change";
export const COMPLETION_SOUND_PATH_CHANGE_EVENT =
  "monocode:completion-sound-path-change";

export type SoundCue =
  | "turnFinished"
  | "inboxUnseen"
  | "updateAvailable"
  | "switch"
  | "copy";

function leafName(path: string): string {
  const trimmed = slash(path).replace(/\/+$/, "");
  const parts = trimmed.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? trimmed;
}

export function loadSoundsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return SOUNDS_DEFAULT;
    return raw === "1" || raw === "true";
  } catch {
    return SOUNDS_DEFAULT;
  }
}

export function saveSoundsEnabled(value: boolean) {
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(SOUNDS_CHANGE_EVENT, { detail: value }),
  );
}

export function loadCompletionSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(COMPLETION_KEY);
    if (raw == null) return COMPLETION_SOUND_DEFAULT;
    return raw === "1" || raw === "true";
  } catch {
    return COMPLETION_SOUND_DEFAULT;
  }
}

export function saveCompletionSoundEnabled(value: boolean) {
  try {
    localStorage.setItem(COMPLETION_KEY, value ? "1" : "0");
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(COMPLETION_SOUND_CHANGE_EVENT, { detail: value }),
  );
}

export function subscribeCompletionSoundEnabled(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(COMPLETION_SOUND_CHANGE_EVENT, onStoreChange);
  return () =>
    window.removeEventListener(COMPLETION_SOUND_CHANGE_EVENT, onStoreChange);
}

export function loadCompletionSoundPath(): string | null {
  try {
    const raw = localStorage.getItem(COMPLETION_PATH_KEY);
    if (!raw) return null;
    return raw;
  } catch {
    return null;
  }
}

export function saveCompletionSoundPath(value: string | null) {
  try {
    if (value) localStorage.setItem(COMPLETION_PATH_KEY, value);
    else localStorage.removeItem(COMPLETION_PATH_KEY);
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<string | null>(COMPLETION_SOUND_PATH_CHANGE_EVENT, {
      detail: value,
    }),
  );
}

export function subscribeCompletionSoundPath(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(COMPLETION_SOUND_PATH_CHANGE_EVENT, onStoreChange);
  return () =>
    window.removeEventListener(COMPLETION_SOUND_PATH_CHANGE_EVENT, onStoreChange);
}

/** No-op kept for boot; playback is host-native for the OS volume mixer. */
export function initSounds() {}

function emitAppSound(kind: SoundCue, path: string | null) {
  void invoke("play_app_sound", {
    kind,
    path,
    volume: SOUNDS_VOLUME,
  }).catch(() => {
    // Missing audio device / unsupported format — stay silent.
  });
}

export function playCue(cue: SoundCue) {
  if (cue === "turnFinished") {
    if (!loadCompletionSoundEnabled()) return;
    emitAppSound(cue, loadCompletionSoundPath());
    return;
  }
  if (!loadSoundsEnabled()) return;
  emitAppSound(cue, null);
}

/** Preview the current completion sound (custom file or built-in). */
export function previewCompletionSound() {
  emitAppSound("turnFinished", loadCompletionSoundPath());
}

export async function pickAndSetCompletionSound(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    title: "Choose completion sound",
    filters: [
      {
        name: "Audio",
        extensions: ["mp3", "wav", "ogg", "m4a", "aac"],
      },
    ],
  });
  if (typeof selected !== "string" || !selected) return null;
  const path = await invoke<string>("save_completion_sound", {
    sourcePath: slash(selected),
  });
  saveCompletionSoundPath(path);
  return path;
}

export async function clearCompletionSound(): Promise<void> {
  try {
    await invoke("remove_completion_sound");
  } catch {
    // File may already be gone; still clear the setting.
  }
  saveCompletionSoundPath(null);
}

export function completionSoundLabel(path: string | null): string {
  if (!path) return "Default";
  return leafName(path) || "Custom";
}

let inboxDotOn = false;
let inboxPrimed = false;
let announcedUpdate: string | undefined;

/**
 * Rising edge of the project-rail inbox dot, after the first snapshot.
 * Launching with items already unseen must not chime.
 */
export function noteInboxUnseen(isUnseen: boolean) {
  if (isUnseen && !inboxDotOn && inboxPrimed) playCue("inboxUnseen");
  inboxDotOn = isUnseen;
  inboxPrimed = true;
}

/** One cue per available version, including a later probe of the same build. */
export function announceUpdateAvailable(version: string | null) {
  if (!version) {
    announcedUpdate = undefined;
    return;
  }
  if (announcedUpdate === version) return;
  announcedUpdate = version;
  playCue("updateAvailable");
}

/** Test helper: forget which inbox/update cues already fired. */
export function resetSoundCues() {
  inboxDotOn = false;
  inboxPrimed = false;
  announcedUpdate = undefined;
}
