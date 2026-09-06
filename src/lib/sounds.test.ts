import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn(() => Promise.resolve());
const open = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => open(...args),
}));

import {
  announceUpdateAvailable,
  COMPLETION_SOUND_DEFAULT,
  loadCompletionSoundEnabled,
  loadCompletionSoundPath,
  loadSoundsEnabled,
  noteInboxUnseen,
  playCue,
  resetSoundCues,
  saveCompletionSoundEnabled,
  saveCompletionSoundPath,
  saveSoundsEnabled,
  SOUNDS_DEFAULT,
  SOUNDS_VOLUME,
} from "./sounds";

const KEY = "monocode.sounds";
const COMPLETION_KEY = "monocode.completionSound";
const COMPLETION_PATH_KEY = "monocode.completionSoundPath";

function mockLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
}

describe("sounds", () => {
  beforeEach(() => {
    mockLocalStorage();
    invoke.mockClear();
    invoke.mockResolvedValue(undefined);
    resetSoundCues();
  });

  afterEach(() => {
    localStorage.removeItem(KEY);
    localStorage.removeItem(COMPLETION_KEY);
    localStorage.removeItem(COMPLETION_PATH_KEY);
    resetSoundCues();
  });

  it("defaults to on", () => {
    expect(SOUNDS_DEFAULT).toBe(true);
    expect(loadSoundsEnabled()).toBe(true);
    expect(COMPLETION_SOUND_DEFAULT).toBe(true);
    expect(loadCompletionSoundEnabled()).toBe(true);
  });

  it("persists an off switch", () => {
    saveSoundsEnabled(false);
    expect(localStorage.getItem(KEY)).toBe("0");
    expect(loadSoundsEnabled()).toBe(false);
    saveSoundsEnabled(true);
    expect(loadSoundsEnabled()).toBe(true);
  });

  it("persists the completion sound switch", () => {
    saveCompletionSoundEnabled(false);
    expect(localStorage.getItem(COMPLETION_KEY)).toBe("0");
    expect(loadCompletionSoundEnabled()).toBe(false);
    saveCompletionSoundEnabled(true);
    expect(loadCompletionSoundEnabled()).toBe(true);
  });

  it("plays cues through the host process", () => {
    playCue("turnFinished");
    expect(invoke).toHaveBeenCalledWith("play_app_sound", {
      kind: "turnFinished",
      path: null,
      volume: SOUNDS_VOLUME,
    });
    playCue("inboxUnseen");
    expect(invoke).toHaveBeenCalledWith("play_app_sound", {
      kind: "inboxUnseen",
      path: null,
      volume: SOUNDS_VOLUME,
    });
    playCue("switch");
    expect(invoke).toHaveBeenCalledWith("play_app_sound", {
      kind: "switch",
      path: null,
      volume: SOUNDS_VOLUME,
    });
  });

  it("plays completion when only the completion toggle is on", () => {
    saveSoundsEnabled(false);
    saveCompletionSoundEnabled(true);
    invoke.mockClear();
    playCue("turnFinished");
    expect(invoke).toHaveBeenCalledWith("play_app_sound", {
      kind: "turnFinished",
      path: null,
      volume: SOUNDS_VOLUME,
    });
    invoke.mockClear();
    playCue("switch");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("skips completion when only UI sounds are on", () => {
    saveSoundsEnabled(true);
    saveCompletionSoundEnabled(false);
    invoke.mockClear();
    playCue("turnFinished");
    expect(invoke).not.toHaveBeenCalled();
    playCue("copy");
    expect(invoke).toHaveBeenCalledWith("play_app_sound", {
      kind: "copy",
      path: null,
      volume: SOUNDS_VOLUME,
    });
  });

  it("is silent when both toggles are off", () => {
    saveSoundsEnabled(false);
    saveCompletionSoundEnabled(false);
    invoke.mockClear();
    playCue("turnFinished");
    playCue("inboxUnseen");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("passes a custom completion file to the host player", () => {
    saveCompletionSoundPath("C:/AppData/completion-sound/completion.mp3");
    expect(loadCompletionSoundPath()).toContain("completion.mp3");
    invoke.mockClear();
    playCue("turnFinished");
    expect(invoke).toHaveBeenCalledWith("play_app_sound", {
      kind: "turnFinished",
      path: "C:/AppData/completion-sound/completion.mp3",
      volume: SOUNDS_VOLUME,
    });
  });

  it("does not ding for the first inbox snapshot", () => {
    noteInboxUnseen(true);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("dings once when the inbox dot appears, then again after it clears", () => {
    noteInboxUnseen(false);
    noteInboxUnseen(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("play_app_sound", {
      kind: "inboxUnseen",
      path: null,
      volume: SOUNDS_VOLUME,
    });
    noteInboxUnseen(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    noteInboxUnseen(false);
    noteInboxUnseen(true);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("dings once per update version", () => {
    announceUpdateAvailable("0.2.0");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("play_app_sound", {
      kind: "updateAvailable",
      path: null,
      volume: SOUNDS_VOLUME,
    });
    announceUpdateAvailable("0.2.0");
    expect(invoke).toHaveBeenCalledTimes(1);
    announceUpdateAvailable("0.2.1");
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
