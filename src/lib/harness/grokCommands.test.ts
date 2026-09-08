import { describe, expect, it } from "vitest";
import {
  grokCommandsFromAcp,
  parseGrokBtwPrompt,
} from "./grokCommands";

describe("grokCommandsFromAcp", () => {
  it("parses availableCommands with input hints and meta scope", () => {
    expect(
      grokCommandsFromAcp({
        availableCommands: [
          {
            name: "compact",
            description: "Compress history",
            input: { hint: "optional context" },
            _meta: { scope: "builtin" },
          },
          {
            name: "review-changes",
            description: "Workflow: Review",
            _meta: { workflowSource: "project" },
          },
          { name: "bad name", description: "skip" },
          { name: "compact", description: "duplicate" },
        ],
      }),
    ).toEqual([
      {
        name: "compact",
        invocation: "grok:compact",
        source: "grok",
        description: "Compress history",
        origin: "builtin",
        inputHint: "optional context",
      },
      {
        name: "review-changes",
        invocation: "review-changes",
        source: "grok",
        description: "Workflow: Review",
        origin: "workflow",
      },
    ]);
  });

  it("accepts commands arrays from x.ai/commands/list", () => {
    expect(
      grokCommandsFromAcp({
        commands: [{ name: "loop", description: "Recurring prompt" }],
      }).map((command) => command.name),
    ).toEqual(["loop"]);
  });
});

describe("parseGrokBtwPrompt", () => {
  it("extracts the aside question", () => {
    expect(parseGrokBtwPrompt("/btw check error handling")).toBe(
      "check error handling",
    );
    expect(parseGrokBtwPrompt("  /BTW   still there?  ")).toBe("still there?");
  });

  it("rejects empty or non-btw prompts", () => {
    expect(parseGrokBtwPrompt("/btw")).toBeNull();
    expect(parseGrokBtwPrompt("/btw   ")).toBeNull();
    expect(parseGrokBtwPrompt("/compact")).toBeNull();
    expect(parseGrokBtwPrompt("btw hello")).toBeNull();
  });
});
