import { describe, expect, it } from "vitest";
import { modelsFromListModelsOutput } from "./cursorCatalog";

describe("cursorCatalog", () => {
  it("parses a realistic --list-models output and groups variants", () => {
    const stdout = [
      "auto - Auto",
      "composer-2.5 - Cursor Tab",
      "claude-opus-5-thinking-high - Claude Opus 5 Thinking High",
      "claude-opus-5-thinking - Claude Opus 5 Thinking",
      "gpt-5.6-sol-high - GPT 5.6 Sol High",
      "gpt-5.6-sol-medium - GPT 5.6 Sol Medium",
      "gpt-5.6-sol-low - GPT 5.6 Sol Low",
      "gpt-5.6-luna-high - GPT 5.6 Luna High",
      "gpt-5.6-luna-medium - GPT 5.6 Luna Medium",
      "gpt-5.6-luna-low - GPT 5.6 Luna Low",
    ].join("\n");
    const models = modelsFromListModelsOutput(stdout);
    const nativeIds = models.map((m) => m.nativeId);

    expect(nativeIds).toEqual(
      expect.arrayContaining([
        "auto",
        "composer-2.5",
        "gpt-5.6-sol",
        "gpt-5.6-luna",
        "claude-opus-5",
      ]),
    );
    expect(models.every((m) => m.harness === "cursor")).toBe(true);

    const sol = models.find((m) => m.nativeId === "gpt-5.6-sol");
    expect(sol).toBeDefined();
    expect(sol?.settings?.some((s) => s.id === "reasoning")).toBe(true);
    const solEffort = sol?.settings?.find((s) => s.id === "reasoning");
    expect(solEffort?.options.map((o) => o.value)).toEqual(
      expect.arrayContaining(["high", "medium", "low"]),
    );

    const opus = models.find((m) => m.nativeId === "claude-opus-5");
    expect(opus).toBeDefined();
    expect(opus?.settings?.some((s) => s.id === "thinking")).toBe(true);
  });

  it("strips ANSI codes and skips non-model lines", () => {
    const stdout = [
      "\x1b[1mAvailable models:\x1b[0m",
      "composer-2.5 - Cursor Tab",
      "",
      "  some other text",
    ].join("\n");
    const models = modelsFromListModelsOutput(stdout);
    expect(models.map((m) => m.nativeId)).toEqual(["composer-2.5"]);
  });
});
