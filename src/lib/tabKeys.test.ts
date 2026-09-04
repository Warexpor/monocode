import { describe, expect, it } from "vitest";
import {
  adjacentItemId,
  deferUnhandledEscape,
  focusedBusyAgentSessionId,
  shouldHandleListNavigation,
  shouldIgnoreTerminalCtrlChord,
  isQuitChord,
  isModelPickerChord,
  shouldStopFocusedTurnOnEscape,
  tabCommand,
} from "./tabKeys";

function key(
  partial: Partial<
    Pick<
      KeyboardEvent,
      | "key"
      | "code"
      | "metaKey"
      | "ctrlKey"
      | "altKey"
      | "shiftKey"
      | "isComposing"
      | "defaultPrevented"
      | "repeat"
    >
  >,
): KeyboardEvent {
  return {
    isComposing: false,
    defaultPrevented: false,
    repeat: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    key: "",
    code: "",
    ...partial,
  } as KeyboardEvent;
}

describe("tabCommand", () => {
  it("opens a terminal pane with cmd-backtick", () => {
    expect(tabCommand(key({ key: "`", code: "Backquote", metaKey: true }))).toBe(
      "new-terminal",
    );
  });

  it("opens a terminal workspace tab with shift-cmd-backtick", () => {
    expect(
      tabCommand(
        key({ key: "~", code: "Backquote", metaKey: true, shiftKey: true }),
      ),
    ).toBe("new-terminal-tab");
  });

  it("keeps existing tab chrome bindings", () => {
    expect(tabCommand(key({ key: "t", metaKey: true }))).toBe("new");
    expect(tabCommand(key({ key: "t", ctrlKey: true }))).toBe("new");
    expect(
      tabCommand(key({ key: "t", metaKey: true, altKey: true })),
    ).toBe("close-others");
    expect(
      tabCommand(key({ key: "t", ctrlKey: true, altKey: true })),
    ).toBe("close-others");
    expect(tabCommand(key({ key: "d", metaKey: true }))).toBe("split-right");
    expect(tabCommand(key({ key: "j", metaKey: true }))).toBe(
      "toggle-terminal",
    );
  });

  it("walks tab visit history with cmd-brackets", () => {
    expect(
      tabCommand(key({ key: "[", code: "BracketLeft", metaKey: true })),
    ).toBe("back");
    expect(
      tabCommand(key({ key: "]", code: "BracketRight", metaKey: true })),
    ).toBe("forward");
  });

  it("keeps shift-cmd-brackets as adjacent tab cycle", () => {
    expect(
      tabCommand(
        key({ key: "{", code: "BracketLeft", metaKey: true, shiftKey: true }),
      ),
    ).toBe("prev");
    expect(
      tabCommand(
        key({ key: "}", code: "BracketRight", metaKey: true, shiftKey: true }),
      ),
    ).toBe("next");
  });

  it("uses shift-mod arrows for session and project navigation", () => {
    expect(
      tabCommand(key({ key: "ArrowUp", metaKey: true, shiftKey: true })),
    ).toBe("prev-session");
    expect(
      tabCommand(key({ key: "ArrowDown", metaKey: true, shiftKey: true })),
    ).toBe("next-session");
    expect(
      tabCommand(key({ key: "ArrowLeft", metaKey: true, shiftKey: true })),
    ).toBe("prev-project");
    expect(
      tabCommand(key({ key: "ArrowRight", metaKey: true, shiftKey: true })),
    ).toBe("next-project");
  });

  it("keeps cmd-1…9 as tab activation", () => {
    expect(tabCommand(key({ key: "1", metaKey: true }))).toEqual({
      activate: 0,
    });
    expect(tabCommand(key({ key: "9", ctrlKey: true }))).toEqual({
      activate: -1,
    });
  });
});

describe("adjacentItemId", () => {
  it("cycles ordered item ids and wraps at both ends", () => {
    expect(adjacentItemId(["a", "b", "c"], "b", 1)).toBe("c");
    expect(adjacentItemId(["a", "b", "c"], "c", 1)).toBe("a");
    expect(adjacentItemId(["a", "b", "c"], "a", -1)).toBe("c");
    expect(adjacentItemId(["a", "b", "c"], "missing", 1)).toBe("a");
    expect(adjacentItemId(["a", "b", "c"], "missing", -1)).toBe("c");
    expect(adjacentItemId([], "a", 1)).toBeNull();
  });
});

describe("shouldHandleListNavigation", () => {
  it("blocks list navigation while another text or app surface owns focus", () => {
    expect(
      shouldHandleListNavigation({ blockedTarget: false, surfaceOpen: false }),
    ).toBe(true);
    expect(
      shouldHandleListNavigation({ blockedTarget: true, surfaceOpen: false }),
    ).toBe(false);
    expect(
      shouldHandleListNavigation({ blockedTarget: false, surfaceOpen: true }),
    ).toBe(false);
  });
});

describe("shouldIgnoreTerminalCtrlChord", () => {
  it("lets Ctrl reach the terminal on Windows and Linux", () => {
    expect(
      shouldIgnoreTerminalCtrlChord(key({ key: "d", ctrlKey: true }), true),
    ).toBe(true);
    expect(
      shouldIgnoreTerminalCtrlChord(key({ key: "w", ctrlKey: true }), true),
    ).toBe(true);
  });

  it("still allows Cmd chords and non-terminal Ctrl", () => {
    expect(
      shouldIgnoreTerminalCtrlChord(key({ key: "d", metaKey: true }), true),
    ).toBe(false);
    expect(
      shouldIgnoreTerminalCtrlChord(key({ key: "d", ctrlKey: true }), false),
    ).toBe(false);
  });
});

describe("isModelPickerChord", () => {
  it("matches cmd/ctrl-period without other modifiers", () => {
    expect(isModelPickerChord(key({ key: ".", metaKey: true }))).toBe(true);
    expect(
      isModelPickerChord(key({ key: ".", code: "Period", ctrlKey: true })),
    ).toBe(true);
    expect(
      isModelPickerChord(key({ key: ".", ctrlKey: true, shiftKey: true })),
    ).toBe(false);
    expect(isModelPickerChord(key({ key: "." }))).toBe(false);
  });
});

describe("isQuitChord", () => {
  it("matches cmd/ctrl-q without other modifiers", () => {
    expect(isQuitChord(key({ key: "q", metaKey: true }))).toBe(true);
    expect(isQuitChord(key({ key: "Q", ctrlKey: true }))).toBe(true);
    expect(isQuitChord(key({ key: "q", ctrlKey: true, shiftKey: true }))).toBe(
      false,
    );
    expect(isQuitChord(key({ key: "q" }))).toBe(false);
  });
});

describe("shouldStopFocusedTurnOnEscape", () => {
  const escape = (partial: Partial<KeyboardEvent> = {}) =>
    key({ key: "Escape", ...partial });

  it("stops a busy focused agent turn on plain Escape", () => {
    expect(
      shouldStopFocusedTurnOnEscape(escape(), {
        inTerminal: false,
        focusedSessionBusy: true,
      }),
    ).toBe(true);
  });

  it("does not steal Escape that another surface already handled", () => {
    expect(
      shouldStopFocusedTurnOnEscape(escape({ defaultPrevented: true }), {
        inTerminal: false,
        focusedSessionBusy: true,
      }),
    ).toBe(false);
  });

  it("leaves terminal Escape and idle sessions alone", () => {
    expect(
      shouldStopFocusedTurnOnEscape(escape(), {
        inTerminal: true,
        focusedSessionBusy: true,
      }),
    ).toBe(false);
    expect(
      shouldStopFocusedTurnOnEscape(escape(), {
        inTerminal: false,
        focusedSessionBusy: false,
      }),
    ).toBe(false);
  });

  it("ignores modified, composing, or repeated Escape", () => {
    for (const partial of [
      { metaKey: true },
      { ctrlKey: true },
      { altKey: true },
      { shiftKey: true },
      { isComposing: true },
      { repeat: true },
    ]) {
      expect(
        shouldStopFocusedTurnOnEscape(escape(partial), {
          inTerminal: false,
          focusedSessionBusy: true,
        }),
      ).toBe(false);
    }
  });
});

describe("focusedBusyAgentSessionId", () => {
  const tabs = [{ id: "tab-a", focusedId: "session-a" }];
  const sessions = [{ id: "session-a", busy: true }];

  it("returns only the busy agent session in the exact active tab", () => {
    expect(focusedBusyAgentSessionId("tab-a", tabs, sessions, false)).toBe(
      "session-a",
    );
    expect(
      focusedBusyAgentSessionId("missing", tabs, sessions, false),
    ).toBeNull();
  });

  it("does not stop through diff, terminal-dock, editor, or idle focus", () => {
    expect(
      focusedBusyAgentSessionId(
        "tab-a",
        [{ ...tabs[0], diffFocused: true }],
        sessions,
        false,
      ),
    ).toBeNull();
    expect(focusedBusyAgentSessionId("tab-a", tabs, sessions, true)).toBeNull();
    expect(
      focusedBusyAgentSessionId(
        "tab-a",
        [{ id: "tab-a", focusedId: "editor-pane" }],
        sessions,
        false,
      ),
    ).toBeNull();
    expect(
      focusedBusyAgentSessionId(
        "tab-a",
        tabs,
        [{ id: "session-a", busy: false }],
        false,
      ),
    ).toBeNull();
  });
});

describe("deferUnhandledEscape", () => {
  const escape = (partial: Partial<KeyboardEvent> = {}) =>
    key({ key: "Escape", ...partial });

  it("runs after the keydown dispatch when Escape stays unhandled", () => {
    let deferred: (() => void) | undefined;
    let stopped = false;
    deferUnhandledEscape(
      escape(),
      () => {
        stopped = true;
      },
      (callback) => {
        deferred = callback;
      },
    );
    expect(stopped).toBe(false);
    deferred?.();
    expect(stopped).toBe(true);
  });

  it("yields to a later same-dispatch Escape handler", () => {
    let deferred: (() => void) | undefined;
    let stopped = false;
    const event = escape() as KeyboardEvent & { defaultPrevented: boolean };
    deferUnhandledEscape(
      event,
      () => {
        stopped = true;
      },
      (callback) => {
        deferred = callback;
      },
    );
    Object.defineProperty(event, "defaultPrevented", { value: true });
    deferred?.();
    expect(stopped).toBe(false);
  });

  it("does not schedule an already-handled or repeated Escape", () => {
    let scheduled = 0;
    const defer = () => {
      scheduled += 1;
    };
    deferUnhandledEscape(escape({ defaultPrevented: true }), () => {}, defer);
    deferUnhandledEscape(escape({ repeat: true }), () => {}, defer);
    expect(scheduled).toBe(0);
  });
});
