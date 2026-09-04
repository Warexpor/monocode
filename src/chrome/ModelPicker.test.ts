import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LAYER } from "../lib/layers";

const root = dirname(fileURLToPath(import.meta.url));

describe("ModelPicker portal contract", () => {
  it("opens the menu through Popover at the shared popover layer", () => {
    const source = readFileSync(join(root, "ModelPicker.tsx"), "utf8");
    const popover = readFileSync(join(root, "Popover.tsx"), "utf8");

    expect(source).toContain('from "./Popover"');
    expect(source).toContain("layer={LAYER.popover}");
    expect(source).toContain("<Popover");
    expect(popover).toContain('from "react-dom"');
    expect(popover).toContain("createPortal");
    expect(popover).toContain("document.body");
    expect(popover).toContain("LAYER.popover");
    expect(LAYER.popover).toBe(80);
  });
});
