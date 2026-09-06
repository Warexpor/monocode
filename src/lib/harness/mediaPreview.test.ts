import { describe, expect, it } from "vitest";
import { isMediaToolTitle, mediaUrlFromToolText } from "./mediaPreview";

describe("mediaPreview", () => {
  it("extracts markdown, http, and path media urls", () => {
    expect(mediaUrlFromToolText("![out](https://cdn.example/a.png)")).toBe(
      "https://cdn.example/a.png",
    );
    expect(mediaUrlFromToolText("saved to C:\\tmp\\shot.jpg")).toBe(
      "C:\\tmp\\shot.jpg",
    );
    expect(mediaUrlFromToolText("see ./out/clip.mp4 now")).toBe("./out/clip.mp4");
  });

  it("detects media tool titles", () => {
    expect(isMediaToolTitle("Generating image")).toBe(true);
    expect(isMediaToolTitle("Generating video")).toBe(true);
    expect(isMediaToolTitle("Editing image")).toBe(true);
    expect(isMediaToolTitle("Read file")).toBe(false);
  });
});
