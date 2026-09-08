import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ModalPanel } from "./Modal";

describe("ModalPanel", () => {
  it("names the dialog and close action", () => {
    const markup = renderToStaticMarkup(
      createElement(ModalPanel, {
        title: "Example",
        description: "A reusable shell",
        onClose: vi.fn(),
        children: "Body",
      }),
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Example");
    expect(markup).toContain("A reusable shell");
    expect(markup).toContain("Body");
    expect(markup).toContain('aria-label="Close"');
    expect(markup).toContain("truncate");
  });

  it("disables Close when closeDisabled", () => {
    const markup = renderToStaticMarkup(
      createElement(ModalPanel, {
        title: "Busy",
        onClose: vi.fn(),
        closeDisabled: true,
        children: "Working",
      }),
    );

    expect(markup).toContain("disabled");
  });

  it("lets the description wrap when descriptionMultiline", () => {
    const markup = renderToStaticMarkup(
      createElement(ModalPanel, {
        title: "Long",
        description: "A description that should wrap across lines",
        descriptionMultiline: true,
        onClose: vi.fn(),
        children: "Body",
      }),
    );

    expect(markup).toContain("whitespace-normal");
    expect(markup).not.toContain("truncate");
  });
});
