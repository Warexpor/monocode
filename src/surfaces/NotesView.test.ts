import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NotesListEmpty } from "./NotesView";

describe("NotesListEmpty", () => {
  it("offers Clear search when the filter hides every note", () => {
    const onClearSearch = vi.fn();
    const markup = renderToStaticMarkup(
      createElement(NotesListEmpty, {
        query: "zzz",
        onClearSearch,
      }),
    );

    expect(markup).toContain("No matching notes");
    expect(markup).toContain("Clear search");
    expect(markup).not.toContain("No notes yet");
  });

  it("keeps the true-empty copy when there is no query", () => {
    const markup = renderToStaticMarkup(
      createElement(NotesListEmpty, {
        query: "  ",
        onClearSearch: vi.fn(),
      }),
    );

    expect(markup).toContain(
      "No notes yet. Save a turn from the transcript, or create one here.",
    );
    expect(markup).not.toContain("Clear search");
    expect(markup).not.toContain("No matching notes");
  });
});
