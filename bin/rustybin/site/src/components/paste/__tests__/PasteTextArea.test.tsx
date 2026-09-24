import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PasteTextArea from "../PasteTextArea";

function noop() {}

describe("PasteTextArea line numbers", () => {
  it("renders line 1 even when the editor is empty", () => {
    const { container } = render(
      <PasteTextArea text="" setText={noop} language="none" />,
    );
    const gutter = container.querySelector('[data-testid="line-numbers"]');
    expect(gutter).not.toBeNull();
    const rows = gutter!.querySelectorAll(":scope > div");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toBe("1");
  });

  it("renders one line number per line of text", () => {
    const { container } = render(
      <PasteTextArea text={"alpha\nbeta\ngamma"} setText={noop} language="none" />,
    );
    const gutter = container.querySelector('[data-testid="line-numbers"]');
    expect(gutter).not.toBeNull();
    const rows = gutter!.querySelectorAll(":scope > div");
    expect(rows.length).toBe(3);
    expect(Array.from(rows).map((r) => r.textContent)).toEqual(["1", "2", "3"]);
  });

  it("counts a trailing newline as an extra line", () => {
    const { container } = render(
      <PasteTextArea text={"hello\n"} setText={noop} language="none" />,
    );
    const gutter = container.querySelector('[data-testid="line-numbers"]');
    const rows = gutter!.querySelectorAll(":scope > div");
    expect(Array.from(rows).map((r) => r.textContent)).toEqual(["1", "2"]);
  });

  it("reserves the gutter margin so the placeholder sits beside the numbers", () => {
    const { container } = render(
      <PasteTextArea text="" setText={noop} language="none" />,
    );
    const editor = container.querySelector(".editor-container") as HTMLElement;
    expect(editor).not.toBeNull();
    expect(editor.style.marginLeft).toBe("3.5rem");
  });

  it("hides the gutter when showLineNumbers is false", () => {
    const { container } = render(
      <PasteTextArea text={"a\nb"} setText={noop} language="none" showLineNumbers={false} />,
    );
    expect(container.querySelector('[data-testid="line-numbers"]')).toBeNull();
    const editor = container.querySelector(".editor-container") as HTMLElement;
    expect(editor.style.marginLeft).toBe("0px");
  });
});
