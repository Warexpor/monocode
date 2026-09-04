import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SearchEmptyResults } from "./SearchView";

describe("SearchEmptyResults", () => {
  it("offers Clear filters when the Projects scope hides every hit", () => {
    const onClearScope = vi.fn();
    const markup = renderToStaticMarkup(
      createElement(SearchEmptyResults, {
        scope: "projects",
        onClearScope,
      }),
    );

    expect(markup).toContain("Filters hid all projects");
    expect(markup).toContain("Clear filters");
  });

  it("keeps a quiet No results line for search-only empty", () => {
    const markup = renderToStaticMarkup(
      createElement(SearchEmptyResults, {
        scope: "all",
        onClearScope: vi.fn(),
      }),
    );

    expect(markup).toContain("No results");
    expect(markup).not.toContain("Clear filters");
    expect(markup).not.toContain("Filters hid all projects");
  });
});
