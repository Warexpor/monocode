import { describe, expect, it } from "vitest";
import {
  nextZoomIn,
  nextZoomOut,
  UI_ZOOM_DEFAULT,
  UI_ZOOM_LEVELS,
  uiZoomActionFromEvent,
} from "./uiZoom";

function key(partial: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: "a",
    code: "KeyA",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...partial,
  } as KeyboardEvent;
}

describe("uiZoom levels", () => {
  it("steps up and down within the ladder", () => {
    expect(nextZoomIn(1)).toBe(1.1);
    expect(nextZoomOut(1)).toBe(0.9);
    expect(nextZoomIn(UI_ZOOM_LEVELS[UI_ZOOM_LEVELS.length - 1]!)).toBe(
      UI_ZOOM_LEVELS[UI_ZOOM_LEVELS.length - 1],
    );
    expect(nextZoomOut(UI_ZOOM_LEVELS[0]!)).toBe(UI_ZOOM_LEVELS[0]);
    expect(UI_ZOOM_DEFAULT).toBe(1);
  });
});

describe("uiZoomActionFromEvent", () => {
  it("maps Ctrl+= / - / 0", () => {
    expect(
      uiZoomActionFromEvent(key({ key: "=", code: "Equal", ctrlKey: true })),
    ).toBe("in");
    expect(
      uiZoomActionFromEvent(key({ key: "+", code: "Equal", ctrlKey: true })),
    ).toBe("in");
    expect(
      uiZoomActionFromEvent(key({ key: "-", code: "Minus", ctrlKey: true })),
    ).toBe("out");
    expect(
      uiZoomActionFromEvent(key({ key: "0", code: "Digit0", ctrlKey: true })),
    ).toBe("reset");
  });

  it("ignores chords without mod or with shift/alt", () => {
    expect(uiZoomActionFromEvent(key({ key: "=", code: "Equal" }))).toBeNull();
    expect(
      uiZoomActionFromEvent(
        key({ key: "=", code: "Equal", ctrlKey: true, shiftKey: true }),
      ),
    ).toBeNull();
  });
});
