# Always-on editor line numbers + placeholder alignment — design spec

**Date:** 2026-06-12
**Branch:** `003-foxybin-redesign` (same branch as the rest of the redesign)
**Status:** Awaiting review

## Context

The code editor (`site/src/components/paste/PasteTextArea.tsx`, built on
`react-simple-code-editor`) only shows line numbers when viewing a **saved** paste. While
typing a new paste the gutter is absent, so the editor looks different before vs. after save.

How it works today:
- `renderLineNumbers()` bails out early when `!showLineNumbers || !text` — so even with the
  prop on, an empty editor renders no gutter.
- The gutter is an absolutely-positioned overlay (`w-12`, `pt-[10px]`, rows `h-[21px]`
  `leading-[1.5rem]`) inside the scroll container; the editor is shifted right with
  `marginLeft: showLineNumbers ? "3.5rem" : "0"`.
- The placeholder is the textarea's native `placeholder` attribute. In new-paste mode there is
  no `marginLeft`, so it sits flush-left; turning the gutter on shifts it — the alignment
  concern this spec addresses.
- Callers only enable line numbers for read-only views:
  - `Index.tsx` — `showLineNumbers={isViewMode}` (two instances: default + markdown split pane).
  - `Workspace.tsx` — `showLineNumbers={!isEditable}` (two instances: default + split pane).

## Decisions (locked during brainstorming)

- **Scope: everywhere.** Line numbers are always visible in every `PasteTextArea` instance —
  home-page new paste, workspace file editor, and the markdown split-view editing pane.
- **Empty editor shows line "1" immediately**, with the placeholder to its right. The layout
  must not shift when the first character is typed (VS Code behavior).
- **Keep the `showLineNumbers` prop**, but default it to `true` (Approach A). Not removing the
  prop — it stays available for a future minimal/embed use case.

## Approach

### 1. `PasteTextArea.tsx` — always render the gutter
- Change the guard in `renderLineNumbers()` from `if (!showLineNumbers || !text)` to
  `if (!showLineNumbers)`. An empty string splits to a single line (`"".split("\n")` →
  `[""]`, length 1), so line "1" renders with no extra logic.
- Default the prop: `showLineNumbers = true`.

### 2. Placeholder & vertical alignment
- Align the gutter to the editor's real metrics so each number sits exactly on its text line:
  the editor uses `padding={12}` (12px) and a 21px line-height (0.875rem × 1.5).
  - Gutter top offset → 12px (match the editor padding; currently `pt-[10px]`).
  - Per-row line-height → `leading-[21px]` (match the editor line-height; currently
    `leading-[1.5rem]` = 24px). Keep `h-[21px]`.
- Because the gutter is now always on, `marginLeft` is always `3.5rem`, so the native
  placeholder renders to the right of the gutter, aligned with line 1, with no left-shift on
  first keystroke. Exact pixel result confirmed visually during implementation.

### 3. Call sites — turn it on everywhere
- `Index.tsx`: remove `showLineNumbers={isViewMode}` on both instances (default `true` applies).
- `Workspace.tsx`: remove `showLineNumbers={!isEditable}` on both instances.

## Out of scope (pre-existing, unchanged)
- Horizontal-scroll behavior of the gutter overlay.
- The `readOnly` / disabled editor logic and any byte-stats/limit behavior.

## Testing
- Component test (React Testing Library, already used in the repo) for `PasteTextArea`:
  - Empty `text` → line "1" is rendered.
  - Multi-line `text` → the correct number of line-number rows is rendered.
- Pixel-level alignment and placeholder position are verified manually — CSS positioning is not
  meaningfully unit-testable.
