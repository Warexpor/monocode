import { describe, expect, it } from "vitest";
import { isZenFreeId, recoveryHint } from "./fullSetup";

describe("fullSetup helpers", () => {
  it("classifies zen free ids", () => {
    expect(isZenFreeId("mimo-v2.5-free")).toBe(true);
    expect(isZenFreeId("big-pickle")).toBe(true);
    expect(isZenFreeId("gpt-5.5")).toBe(false);
  });

  it("suggests node recovery for npm errors", () => {
    expect(recoveryHint("prereq", "npm not found")).toMatch(/Node\.js/);
  });

  it("suggests auth recovery for key errors", () => {
    expect(recoveryHint("key", "HTTP 401")).toMatch(/opencode\.ai\/auth/);
  });
});
