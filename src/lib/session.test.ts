import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedIsHarnessAvailable = vi.hoisted(() => vi.fn());

vi.mock("./harness/availability", () => ({
  isHarnessAvailable: mockedIsHarnessAvailable,
}));

import { saveLastModelChoice } from "./models";
import {
  newDefaultSession,
  newSession,
  preferredNewSessionHarness,
} from "./session";

function mockLocalStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
      clear: () => data.clear(),
      key: (index: number) => [...data.keys()][index] ?? null,
      get length() {
        return data.size;
      },
    },
  });
}

describe("new session harness defaults", () => {
  beforeEach(() => {
    mockLocalStorage();
    mockedIsHarnessAvailable.mockReturnValue(false);
  });

  afterEach(() => {
    mockedIsHarnessAvailable.mockReset();
  });

  it("keeps Claude as the fallback when Grok Build is unavailable", () => {
    expect(preferredNewSessionHarness()).toBe("claude");
    expect(newSession().harness).toBe("claude");
    expect(newDefaultSession().harness).toBe("cursor");
  });

  it("prefers Grok Build for new sessions when its CLI is available", () => {
    mockedIsHarnessAvailable.mockReturnValue(true);

    expect(preferredNewSessionHarness()).toBe("grok");
    expect(newSession().harness).toBe("grok");
    expect(newDefaultSession().harness).toBe("grok");
  });

  it("keeps the remembered provider ahead of the Grok preference", () => {
    mockedIsHarnessAvailable.mockReturnValue(true);
    saveLastModelChoice("cursor", "cursor:composer-2.5");

    expect(preferredNewSessionHarness()).toBe("cursor");
    expect(newDefaultSession()).toMatchObject({
      harness: "cursor",
      model: "cursor:composer-2.5",
    });
  });
});
