# Always-on Editor Line Numbers + Placeholder Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show editor line numbers at all times (including while typing a new paste, starting at line "1" on an empty editor) and keep the placeholder aligned to the right of the gutter with no layout shift on first keystroke.

**Architecture:** `PasteTextArea` already renders a line-number gutter, but only for saved/read-only views and never when the text is empty. Make the gutter the default-on behavior inside the component, render line "1" even when empty, align the gutter's vertical metrics to the editor's real padding/line-height, and drop the now-redundant conditional at all four call sites.

**Tech Stack:** TypeScript, React 18, `react-simple-code-editor`, Tailwind CSS, Vitest + @testing-library/react (jsdom).

---

## Background (read before starting)

- Component: `site/src/components/paste/PasteTextArea.tsx`.
  - `renderLineNumbers()` returns `null` when `!showLineNumbers || !text` (line 248). `"".split("\n")` is `[""]` (length 1), so dropping the `!text` guard makes an empty editor render exactly one row, "1".
  - The gutter is an absolutely-positioned overlay: `w-12`, `pt-[10px]`, rows `h-[21px] leading-[1.5rem]` (lines ~262-274).
  - The editor is shifted right with `marginLeft: showLineNumbers ? "3.5rem" : "0"` (line 324). The placeholder is the textarea's native `placeholder`, so this margin is what positions it beside the gutter.
  - The editor itself uses `padding={12}` (12px) and a 21px line-height (0.875rem font × 1.5 from `.editor-container`). We align the gutter to those numbers: top offset 12px (`pt-3`) and per-row `leading-[21px]`.
- Call sites that currently gate the prop:
  - `site/src/pages/Index.tsx:821` and `:839` — `showLineNumbers={isViewMode}`.
  - `site/src/pages/Workspace.tsx:585` and `:605` — `showLineNumbers={!isEditable}`.
- Testing: Vitest with `environment: "jsdom"`, `globals: true`, `setupFiles: []` (so **no** `@testing-library/jest-dom` matchers — use plain DOM assertions like `.toBeNull()` / `.textContent`, matching `site/src/components/layout/__tests__/GitHubLink.test.tsx`).
- The default Prism theme is `prism-foxyz` (`source: "custom"`), so `loadPrismTheme` injects local CSS and returns before any `fetch` — the component renders under jsdom with no network call.
- Run all commands from the `site/` directory.

---

## Task 1: Always-on gutter in `PasteTextArea` (TDD)

**Files:**
- Create: `site/src/components/paste/__tests__/PasteTextArea.test.tsx`
- Modify: `site/src/components/paste/PasteTextArea.tsx` (prop default line 73; guard line 248; gutter wrapper lines ~263-269; row div line ~271)

- [ ] **Step 1: Write the failing test**

Create `site/src/components/paste/__tests__/PasteTextArea.test.tsx`:

```tsx
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
    expect(editor.style.marginLeft).toBe("0");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- PasteTextArea`
Expected: FAIL. The first three tests fail because the gutter has no `data-testid` and, with the current `showLineNumbers = false` default plus the `!text` guard, no gutter is rendered for empty text.

- [ ] **Step 3: Default the prop to on**

In `site/src/components/paste/PasteTextArea.tsx`, change line 73:

```tsx
      showLineNumbers = true,
```

(was `showLineNumbers = false,`)

- [ ] **Step 4: Render the gutter even when empty**

In `renderLineNumbers()`, change the guard (line 248):

```tsx
      if (!showLineNumbers) return null;
```

(was `if (!showLineNumbers || !text) return null;` — the lines below already handle empty text: `"".split("\n")` has length 1.)

- [ ] **Step 5: Add the test hook and align the gutter top offset**

Change the gutter wrapper `<div>` (currently lines ~263-269) to add `data-testid` and replace `pt-[10px]` with `pt-3` (12px, matching the editor's `padding={12}`):

```tsx
        <div
          data-testid="line-numbers"
          className="absolute left-0 top-0 bottom-0 w-12 text-sm pt-3 select-none overflow-hidden pointer-events-none z-[1]"
          style={{
            backgroundColor: lineNumberBgColor,
            color: lineNumberColor,
          }}
        >
```

- [ ] **Step 6: Align the per-row line-height to the editor**

Change the row `<div>` (currently line ~271) to use `leading-[21px]` (matching the editor's 21px line-height) instead of `leading-[1.5rem]`:

```tsx
            <div key={i} className="px-2 text-right h-[21px] leading-[21px]">
              {i + 1}
            </div>
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm run test -- PasteTextArea`
Expected: PASS (4 passed).

- [ ] **Step 8: Commit**

```bash
git add site/src/components/paste/PasteTextArea.tsx site/src/components/paste/__tests__/PasteTextArea.test.tsx
git commit -m "feat(editor): always show line numbers, render line 1 when empty"
```

---

## Task 2: Remove the now-redundant prop at the call sites

The component now defaults to `showLineNumbers={true}`, so the conditional props at the call sites are dead weight and would let the gutter disappear during editing. Remove them so every instance gets the always-on default.

**Files:**
- Modify: `site/src/pages/Index.tsx` (lines 821 and 839)
- Modify: `site/src/pages/Workspace.tsx` (lines 585 and 605)

- [ ] **Step 1: Remove the prop in `Index.tsx` (split-view editor)**

Delete this line (line 821):

```tsx
                    showLineNumbers={isViewMode}
```

- [ ] **Step 2: Remove the prop in `Index.tsx` (default editor)**

Delete this line (line 839):

```tsx
                showLineNumbers={isViewMode}
```

- [ ] **Step 3: Remove the prop in `Workspace.tsx` (split-view editor)**

Delete this line (line 585):

```tsx
                    showLineNumbers={!isEditable}
```

- [ ] **Step 4: Remove the prop in `Workspace.tsx` (default editor)**

Delete this line (line 605):

```tsx
                showLineNumbers={!isEditable}
```

- [ ] **Step 5: Verify no stale references and the build is clean**

Run: `npm run lint`
Expected: no new errors. (`isViewMode` and `isEditable` are still used elsewhere in their files, so no unused-variable warnings.)

Run: `npm run build`
Expected: type-checks and builds successfully.

Run: `npm run test`
Expected: full suite passes (including the four new PasteTextArea tests).

- [ ] **Step 6: Commit**

```bash
git add site/src/pages/Index.tsx site/src/pages/Workspace.tsx
git commit -m "feat(editor): show line numbers while editing on home and workspace"
```

---

## Task 3: Manual visual verification

CSS positioning (pixel-exact alignment and placeholder placement) is not meaningfully unit-testable, so verify it in the running app.

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open the printed local URL (default `http://localhost:5173`).

- [ ] **Step 2: Verify the empty new-paste state**

On the home page with an empty editor, confirm:
- Line number "1" is visible in the gutter immediately.
- The placeholder text begins to the right of the gutter, vertically aligned with line "1".

- [ ] **Step 3: Verify typing does not shift the layout**

Type several lines. Confirm:
- The placeholder does not jump left/right between the empty state and the first character typed.
- Line numbers increment (1, 2, 3, …) and each number sits on its corresponding text line.

- [ ] **Step 4: Verify the workspace editor and split view**

- Create/open a workspace and confirm an editable file shows line numbers while typing.
- Switch a markdown file to split view and confirm the editor pane shows line numbers.

- [ ] **Step 5: Verify read-only view still looks correct**

Open a saved paste (read-only). Confirm line numbers still render and remain aligned (this path was already on; just confirm no regression from the alignment changes).

---

## Self-Review (completed during planning)

- **Spec coverage:**
  - "Everywhere" scope → Task 2 removes the gate at all four call sites; component default-on → Task 1 Step 3.
  - "Show line 1 immediately on empty" → Task 1 Steps 4 + 1 (test).
  - "Placeholder positioned correctly / no shift" → Task 1 Steps 5-6 (alignment) + margin test; Task 3 Steps 2-3 (manual).
  - Keep `showLineNumbers` prop → preserved; only its default changes (Task 1 Step 3); off-path covered by the false-case test.
  - Testing approach (RTL, no jest-dom matchers) → Task 1 Step 1.
  - Out-of-scope items (horizontal scroll, readOnly logic) → untouched.
- **Placeholder scan:** no TBD/TODO; every code step shows exact content.
- **Type/name consistency:** `data-testid="line-numbers"` is defined in Task 1 Step 5 and queried in Task 1 Step 1; prop name `showLineNumbers` matches the existing signature.
