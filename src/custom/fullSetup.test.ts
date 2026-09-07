import { describe, expect, it } from "vitest";
import { isZenFreeId, recoveryHint } from "./fullSetup";

describe("fullSetup helpers", () => {
  it("classifies zen free ids", () => {
    expect(isZenFreeId("mimo-v2.5-free")).toBe(true);
    expect(isZenFreeId("big-pickle")).toBe(true);
    expect(isZenFreeId("provider/big-pickle")).toBe(true);
    expect(isZenFreeId("gpt-5.5")).toBe(false);
  });

  it("suggests node recovery for npm errors", () => {
    expect(recoveryHint("prereq", "npm not found")).toMatch(/Node\.js/);
  });

  it("suggests grok path recovery after install", () => {
    expect(recoveryHint("grok", "install.ps1 failed")).toMatch(/PATH|restart/i);
  });

  it("suggests npm check for OpenCodex install failures", () => {
    expect(recoveryHint("ocx", "@bitkyc08/opencodex failed")).toMatch(/npm -v/);
  });

  it("suggests auth recovery for key errors", () => {
    expect(recoveryHint("key", "HTTP 401")).toMatch(/opencode\.ai\/auth/);
  });

  it("suggests ocx ensure when apply cannot reach the proxy", () => {
    expect(recoveryHint("apply", "ocx not healthy on 10100")).toMatch(/ocx ensure/);
  });

  it("falls back to a generic resume hint", () => {
    expect(recoveryHint("models", "unexpected")).toMatch(/resume Full Setup/);
  });
});
