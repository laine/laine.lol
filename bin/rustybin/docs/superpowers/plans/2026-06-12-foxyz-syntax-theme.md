# Foxyz Editor Background + Syntax Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the code editor a `#0F1014` background and a custom, legible "Foxyz" Prism syntax theme (orange keywords, teal types) that is the default for everyone.

**Architecture:** All changes are in `site/src/utils/prism-theme-utils.ts`. We add a `source: "custom"` theme whose token colors ship as a local CSS string (the loader otherwise fetches per-theme CSS from a CDN, and no CDN file exists for a custom theme). `loadPrismTheme` injects that local CSS and skips the fetch for custom themes. The default and the localStorage key are changed so returning visitors (who already have `prism-tomorrow` saved) land on Foxyz.

**Tech Stack:** TypeScript, Prism.js (token CSS classes `.token.*`), Vitest + jsdom (localStorage/DOM available; `globals: true`).

**Branch:** `003-foxybin-redesign` (same branch as the rest of the redesign). Run commands from repo root; each Bash call starts at repo root, so invoke the suite as `npx vitest run ...` with `--prefix site` for npm or `cd site && ...` within a single command.

**Spec:** `docs/superpowers/specs/2026-06-12-foxyz-syntax-theme-design.md`

---

## Task 1: Register the Foxyz theme, make it the default, bump the storage key

**Files:**
- Modify: `site/src/utils/prism-theme-utils.ts`
- Test: `site/src/utils/__tests__/prism-theme-utils.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `site/src/utils/__tests__/prism-theme-utils.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prismThemes, getStoredPrismTheme, getThemeBackground } from "../prism-theme-utils";

describe("Foxyz theme registration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("registers a custom Foxyz theme on #0F1014", () => {
    const foxyz = prismThemes.find((t) => t.value === "prism-foxyz");
    expect(foxyz).toBeDefined();
    expect(foxyz?.background).toBe("#0F1014");
    expect(foxyz?.textColor).toBe("#e5e7eb");
    expect(foxyz?.source).toBe("custom");
  });

  it("defaults to Foxyz when nothing is stored", () => {
    expect(getStoredPrismTheme()).toBe("prism-foxyz");
  });

  it("ignores the legacy storage key so returning users still get Foxyz", () => {
    localStorage.setItem("rustybin-prism-theme", "prism-tomorrow");
    expect(getStoredPrismTheme()).toBe("prism-foxyz");
  });

  it("getThemeBackground returns #0F1014 for Foxyz", () => {
    expect(getThemeBackground("prism-foxyz")).toBe("#0F1014");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd site && npx vitest run src/utils/__tests__/prism-theme-utils.test.ts`
Expected: FAIL — no `prism-foxyz` theme; `getStoredPrismTheme()` returns `"prism-tomorrow"`.

- [ ] **Step 3: Add the Foxyz theme entry (first in the array)**

In `site/src/utils/prism-theme-utils.ts`, insert this object as the FIRST element of the `prismThemes` array (immediately after `export const prismThemes = [`):

```ts
  // Custom foxyz theme — token colors shipped locally (see FOXYZ_THEME_CSS)
  {
    value: "prism-foxyz",
    label: "Foxyz",
    background: "#0F1014",
    textColor: "#e5e7eb",
    source: "custom",
  },
```

- [ ] **Step 4: Change the storage key and default fallbacks**

In the same file:

- Change the storage key constant:
```ts
const STORAGE_KEY = "foxybin-prism-theme";
```
- In `getStoredPrismTheme`, change BOTH fallbacks from `"prism-tomorrow"` to `"prism-foxyz"`:
```ts
export function getStoredPrismTheme(): PrismTheme {
  if (typeof window === "undefined") return "prism-foxyz";

  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  const parsed = PrismThemeSchema.safeParse(storedTheme);
  return parsed.success ? parsed.data : "prism-foxyz";
}
```
- In `getThemeBackground`, change the not-found fallback to `"#0F1014"`:
```ts
export function getThemeBackground(theme: PrismTheme): string {
  const themeObj = prismThemes.find((t) => t.value === theme);
  return themeObj ? themeObj.background : "#0F1014";
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd site && npx vitest run src/utils/__tests__/prism-theme-utils.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add site/src/utils/prism-theme-utils.ts site/src/utils/__tests__/prism-theme-utils.test.ts
git commit -m "feat(editor): register Foxyz theme as default, bump storage key"
```

---

## Task 2: Ship local token CSS and inject it for custom themes

**Files:**
- Modify: `site/src/utils/prism-theme-utils.ts`
- Test: `site/src/utils/__tests__/prism-theme-utils.test.ts` (extend)

- [ ] **Step 1: Add the failing test**

Append this `describe` block to `site/src/utils/__tests__/prism-theme-utils.test.ts`:

```ts
import { loadPrismTheme } from "../prism-theme-utils";

describe("loadPrismTheme — custom themes", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.removeAttribute("data-prism-theme");
    document.documentElement.removeAttribute("style");
  });

  it("injects local token CSS for Foxyz and sets the background var (no fetch)", () => {
    loadPrismTheme("prism-foxyz");

    const style = document.getElementById("prism-theme-style");
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain('[data-prism-theme="prism-foxyz"]');
    expect(style?.textContent).toContain(".token.keyword");
    expect(style?.textContent).toContain("#ff6600");
    expect(document.documentElement.style.getPropertyValue("--prism-bg")).toBe("#0F1014");
    expect(document.body.dataset.prismTheme).toBe("prism-foxyz");
  });
});
```

Add the `loadPrismTheme` import to the existing import from `"../prism-theme-utils"` at the top (or use the separate import shown above — both resolve to the same module).

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd site && npx vitest run src/utils/__tests__/prism-theme-utils.test.ts`
Expected: FAIL — `#prism-theme-style` has no Foxyz CSS (the function currently tries to `fetch` a CDN URL for every theme; `#ff6600`/the scoped selector are absent).

- [ ] **Step 3: Add the `FOXYZ_THEME_CSS` constant**

In `site/src/utils/prism-theme-utils.ts`, add this constant just above the `loadPrismTheme` function:

```ts
// Local token colors for the custom Foxyz theme (palette C).
// Scoped under the body data attribute so it never leaks into CDN themes.
const FOXYZ_THEME_CSS = `
[data-prism-theme="prism-foxyz"] .token.comment,
[data-prism-theme="prism-foxyz"] .token.prolog,
[data-prism-theme="prism-foxyz"] .token.doctype,
[data-prism-theme="prism-foxyz"] .token.cdata { color: #5f6672; font-style: italic; }

[data-prism-theme="prism-foxyz"] .token.punctuation { color: #8a90a0; }

[data-prism-theme="prism-foxyz"] .token.keyword,
[data-prism-theme="prism-foxyz"] .token.atrule,
[data-prism-theme="prism-foxyz"] .token.selector,
[data-prism-theme="prism-foxyz"] .token.tag { color: #ff6600; font-weight: 600; }

[data-prism-theme="prism-foxyz"] .token.class-name,
[data-prism-theme="prism-foxyz"] .token.builtin,
[data-prism-theme="prism-foxyz"] .token.property,
[data-prism-theme="prism-foxyz"] .token.attr-name { color: #5ed3c0; }

[data-prism-theme="prism-foxyz"] .token.function,
[data-prism-theme="prism-foxyz"] .token.function-variable { color: #ffc06a; }

[data-prism-theme="prism-foxyz"] .token.string,
[data-prism-theme="prism-foxyz"] .token.char,
[data-prism-theme="prism-foxyz"] .token.attr-value,
[data-prism-theme="prism-foxyz"] .token.regex,
[data-prism-theme="prism-foxyz"] .token.inserted { color: #8ee3b6; }

[data-prism-theme="prism-foxyz"] .token.number,
[data-prism-theme="prism-foxyz"] .token.boolean,
[data-prism-theme="prism-foxyz"] .token.constant,
[data-prism-theme="prism-foxyz"] .token.symbol { color: #d3b1ff; }

[data-prism-theme="prism-foxyz"] .token.operator,
[data-prism-theme="prism-foxyz"] .token.entity,
[data-prism-theme="prism-foxyz"] .token.url { color: #9aa0ae; }

[data-prism-theme="prism-foxyz"] .token.deleted { color: #d72d3f; }
[data-prism-theme="prism-foxyz"] .token.namespace { opacity: 0.7; }
[data-prism-theme="prism-foxyz"] .token.important,
[data-prism-theme="prism-foxyz"] .token.bold { font-weight: 700; }
[data-prism-theme="prism-foxyz"] .token.italic { font-style: italic; }
`;
```

- [ ] **Step 4: Inject local CSS for custom themes (skip the CDN fetch)**

Replace the **entire** `loadPrismTheme` function body with the version below. The only changes vs. the original: an early-return block that injects `FOXYZ_THEME_CSS` when `themeObj?.source === "custom"`, and the catch fallback now points to `"prism-foxyz"`.

```ts
export function loadPrismTheme(theme: PrismTheme): void {
  if (typeof document === "undefined") return;

  // Create or get the theme style element
  const existingElement = document.getElementById("prism-theme-style");
  const styleElement = existingElement ?? (() => {
    const el = document.createElement("style");
    el.id = "prism-theme-style";
    document.head.appendChild(el);
    return el;
  })();

  // Save the theme name as a data attribute on the body
  document.body.dataset.prismTheme = theme;

  // Get theme colors
  const themeObj = prismThemes.find((t) => t.value === theme);
  if (themeObj) {
    document.documentElement.style.setProperty("--prism-bg", themeObj.background);
    document.documentElement.style.setProperty("--prism-text-color", themeObj.textColor);

    // Force all editor containers to use these colors
    setTimeout(() => {
      const editors = document.querySelectorAll(".editor-container");
      editors.forEach((editor) => {
        const editorEl = editor as HTMLElement;
        editorEl.style.backgroundColor = themeObj.background;
        editorEl.style.color = themeObj.textColor;

        const textElements = editorEl.querySelectorAll("pre, code, textarea");
        textElements.forEach((el) => {
          const elem = el as HTMLElement;
          elem.style.backgroundColor = "transparent";
          elem.style.color = themeObj.textColor;
        });
      });
    }, 0);
  }

  // Custom themes ship token colors locally — inject and skip the CDN fetch.
  if (themeObj?.source === "custom") {
    styleElement.textContent = FOXYZ_THEME_CSS;
    return;
  }

  // Determine the URL based on the theme source
  const themeWithoutPrefix = theme.replace("prism-", "");
  const isDefaultTheme = themeObj?.source === "default";

  const themeUrl = isDefaultTheme
    ? `https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-${themeWithoutPrefix}.min.css`
    : `https://cdn.jsdelivr.net/npm/prism-themes@1.9.0/themes/prism-${themeWithoutPrefix}.min.css`;

  fetch(themeUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load theme: ${response.statusText}`);
      }
      return response.text();
    })
    .then((css) => {
      const modifiedCss = css
        .replace(/background(-color)?:\s*[^;]+;/g, "background: transparent;")
        .replace(/box-shadow:[^;]+;/g, "box-shadow: none !important;")
        .replace(/border(-\w+)?:[^;]+;/g, "");

      styleElement.textContent = modifiedCss;
    })
    .catch((err) => {
      console.error(`Failed to load theme ${theme}:`, err);

      if (theme !== "prism-foxyz") {
        console.log("Falling back to default theme");
        setTheme("prism-foxyz");
      }
    });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd site && npx vitest run src/utils/__tests__/prism-theme-utils.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 6: Commit**

```bash
git add site/src/utils/prism-theme-utils.ts site/src/utils/__tests__/prism-theme-utils.test.ts
git commit -m "feat(editor): inject local Foxyz token CSS; orange-led syntax theme on #0F1014"
```

---

## Task 3: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Lint, test, build**

Run, in order:
- `npm --prefix site run test` → expected: all tests pass (existing suites + the new `prism-theme-utils` suite).
- `npm --prefix site run lint` → expected: no NEW errors referencing `prism-theme-utils.ts` (the pre-existing `tailwind.config.ts` / `textarea.tsx` errors are unrelated).
- `npm --prefix site run build` → expected: success.

- [ ] **Step 2: Visual check (`npm --prefix site run dev`, http://localhost:5173)**

In a fresh session (or after clearing `localStorage`):
- The create-page editor has a `#0F1014` background.
- Type/paste TypeScript, Rust, JSON, and Markdown and confirm: keywords orange + bold, types teal, functions amber, strings green, numbers soft purple, comments muted italic; body text is legible (`#e5e7eb`).
- Confirm no `prism-tomorrow` flash and no console error about a failed theme fetch.

- [ ] **Step 3: Confirm mainline untouched**

Run: `git branch --show-current` (→ `003-foxybin-redesign`) and `git log --oneline master..HEAD | head -3`.

---

## Self-review notes (coverage check)

- Spec "editor background `#0F1014`" → Task 1 (theme `background`) + verified Task 3.
- Spec "Foxyz theme = palette C, token mapping" → Task 2 (`FOXYZ_THEME_CSS` matches the spec table exactly).
- Spec "made default + storage-key bump" → Task 1 (`STORAGE_KEY`, `getStoredPrismTheme` fallbacks).
- Spec "custom source injects local CSS, skips CDN; CDN themes unchanged" → Task 2 (`loadPrismTheme` early-return; fetch path preserved).
- Spec "scoped under `[data-prism-theme="prism-foxyz"]`" → Task 2 CSS selectors.
- Spec catch-fallback should not loop on the new default → Task 2 (`if (theme !== "prism-foxyz")`).
- Spec verification → Task 3.
