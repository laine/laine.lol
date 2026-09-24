# foxybin Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the rustybin frontend to the foxyz.net look (near-black surfaces, orange brand, Rubik type, flat border-divided surfaces) and rebrand it to **foxybin**, with zero feature/backend changes.

**Architecture:** The theme is centralized in HSL CSS variables (`site/src/index.css`) consumed via `hsl(var(--x))` in `site/tailwind.config.ts`. Most of the recolor happens by (1) rewriting those variables to the foxyz palette and (2) a consistent find/replace of the handful of hardcoded surface hexes that bypass the tokens. On top of that: swap the UI font to Rubik, refine the Button, add a reusable GitHub link, rebrand the chrome/wordmarks, and recolor the admin charts + markdown accents.

**Tech Stack:** React 18 + Vite 5 + TypeScript, Tailwind v3 + shadcn/ui (Radix), Recharts, Vitest + Testing Library.

**Working branch:** `003-foxybin-redesign` (already created off `master`). All commits land here; `master`/`main` stay untouched.

**Spec:** `docs/superpowers/specs/2026-06-12-foxybin-redesign-design.md`

**Note on TDD:** This is largely a visual reskin, so most tasks are verified by a green build + lint + a visual checklist rather than unit tests. Genuine behavior (the GitHub link) gets a real test-first task (Task 4). All commands below run from the `site/` directory unless stated otherwise.

---

## Palette reference (used throughout)

Source-of-truth hex → the `H S% L%` triplet stored in the CSS variables (Tailwind wraps them in `hsl(...)`).

| Role | Hex | HSL triplet |
|---|---|---|
| page / `--background` | `#14151b` | `231 15% 9%` |
| chrome / navbar / sidebar bg | `#0d0e11` | `225 13% 6%` |
| card / popover surface | `#0F1014` | `228 14% 7%` |
| nested field / `--secondary`/`--muted`/`--accent` | `#1a1b20` | `230 10% 11%` |
| border / input | `#20222a` | `228 14% 15%` |
| heading / primary text | `#e5e7eb` | `220 13% 91%` |
| muted text | `#888b98` | `229 7% 56%` |
| brand / primary / ring | `#ff6600` | `24 100% 50%` |
| on-primary text | `#ffffff` | `0 0% 100%` |
| destructive | `#d72d3f` | `354 68% 51%` |
| success | `#139a65` | `156 78% 34%` |
| warning | `#eab308` | `45 93% 47%` |

Brand gradient (raw hex, for `bg-clip-text`): `linear-gradient(180deg, #FF6600, #dc3e00)`.

---

## Task 1: Theme tokens, fonts, radius, base utilities

**Files:**
- Modify: `site/src/index.css`
- Modify: `site/tailwind.config.ts`

- [ ] **Step 1: Replace the font import and rewrite the theme variables in `site/src/index.css`**

Replace line 1 (the `@import url(...)` for Inter) with Rubik + JetBrains Mono:

```css
@import url("https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap");
```

Replace the entire `:root { ... }` and `.dark { ... }` blocks (lines 8–82) with the following. Because the app is dark-only (forces `.dark`), both blocks carry the same dark palette to avoid any pre-mount flash:

```css
  :root,
  .dark {
    --radius: 0.5rem;

    --background: 231 15% 9%;
    --foreground: 220 13% 91%;

    --card: 228 14% 7%;
    --card-foreground: 220 13% 91%;

    --popover: 228 14% 7%;
    --popover-foreground: 220 13% 91%;

    --primary: 24 100% 50%;
    --primary-foreground: 0 0% 100%;

    --secondary: 230 10% 11%;
    --secondary-foreground: 220 13% 91%;

    --muted: 230 10% 11%;
    --muted-foreground: 229 7% 56%;

    --accent: 230 10% 11%;
    --accent-foreground: 220 13% 91%;

    --destructive: 354 68% 51%;
    --destructive-foreground: 0 0% 100%;

    --success: 156 78% 34%;
    --warning: 45 93% 47%;

    --border: 228 14% 15%;
    --input: 228 14% 15%;
    --ring: 24 100% 50%;

    --sidebar-background: 225 13% 6%;
    --sidebar-foreground: 220 13% 91%;
    --sidebar-primary: 24 100% 50%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 230 10% 11%;
    --sidebar-accent-foreground: 220 13% 91%;
    --sidebar-border: 228 14% 15%;
    --sidebar-ring: 24 100% 50%;
  }
```

- [ ] **Step 2: Update the `body` base style and add the `.brand-gradient` utility in `site/src/index.css`**

Change the `body` rule (was `@apply bg-[#2D2D2D] text-foreground;`) to use the token plus a faint grain:

```css
  body {
    @apply bg-background text-foreground;
    background-image: radial-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px);
    background-size: 7px 7px;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
```

Add this utility (place it just after the closing `}` of the second `@layer base`, near the existing `.text-rainbow` block):

```css
/* foxyz brand wordmark gradient */
.brand-gradient {
  background: linear-gradient(180deg, #ff6600, #dc3e00);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
```

- [ ] **Step 3: Update fonts, enable alpha modifiers, and add success/warning in `site/tailwind.config.ts`**

Change the `sans` font stack (lines 23–28) to lead with Rubik:

```ts
        sans: [
          'Rubik',
          'system-ui',
          'sans-serif'
        ],
```

Replace the entire `colors: { ... }` object (lines 35–79) with this version — every token uses the `/ <alpha-value>` form so Tailwind opacity modifiers (`bg-primary/20`, `border-primary/55`, etc.) work, and `success`/`warning` are added:

```ts
        colors: {
          border: 'hsl(var(--border) / <alpha-value>)',
          input: 'hsl(var(--input) / <alpha-value>)',
          ring: 'hsl(var(--ring) / <alpha-value>)',
          background: 'hsl(var(--background) / <alpha-value>)',
          foreground: 'hsl(var(--foreground) / <alpha-value>)',
          primary: {
            DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
            foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
          },
          secondary: {
            DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
            foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)'
          },
          destructive: {
            DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
            foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
          },
          success: {
            DEFAULT: 'hsl(var(--success) / <alpha-value>)',
            foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
          },
          warning: {
            DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
            foreground: 'hsl(0 0% 0% / <alpha-value>)'
          },
          muted: {
            DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
            foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
          },
          accent: {
            DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
            foreground: 'hsl(var(--accent-foreground) / <alpha-value>)'
          },
          popover: {
            DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
            foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
          },
          card: {
            DEFAULT: 'hsl(var(--card) / <alpha-value>)',
            foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
          },
          sidebar: {
            DEFAULT: 'hsl(var(--sidebar-background) / <alpha-value>)',
            foreground: 'hsl(var(--sidebar-foreground) / <alpha-value>)',
            primary: 'hsl(var(--sidebar-primary) / <alpha-value>)',
            'primary-foreground': 'hsl(var(--sidebar-primary-foreground) / <alpha-value>)',
            accent: 'hsl(var(--sidebar-accent) / <alpha-value>)',
            'accent-foreground': 'hsl(var(--sidebar-accent-foreground) / <alpha-value>)',
            border: 'hsl(var(--sidebar-border) / <alpha-value>)',
            ring: 'hsl(var(--sidebar-ring) / <alpha-value>)'
          }
        },
```

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds with no errors (Tailwind compiles the new tokens; TypeScript passes).

- [ ] **Step 5: Visual smoke check**

Run: `npm run dev`, open http://localhost:5173
Expected: page background is near-black navy, text is light, the orange accent replaces the old rose on focus rings / active nav. (Chrome still has hardcoded greys until Task 2 — that's expected.)

- [ ] **Step 6: Commit**

```bash
git add site/src/index.css site/tailwind.config.ts
git commit -m "feat(theme): foxyz palette, Rubik font, alpha tokens, brand gradient"
```

---

## Task 2: Sweep hardcoded surface hexes to the foxyz palette

These literals bypass the tokens and repeat across ~25 files (header/footer/dialogs/popovers/selects/switch/sonner/admin/workspace). They map 1:1 to foxyz surfaces, so replace them globally.

**Files:** all of `site/src/**` (TSX/CSS). Representative paths: `components/layout/Layout.tsx`, `pages/Index.tsx`, `pages/Workspace.tsx`, `components/paste/*.tsx`, `components/ui/{select,switch,sonner}.tsx`, `components/admin/*.tsx`, `pages/Admin*.tsx`.

- [ ] **Step 1: Run the replacements** (from repo root `E:\Projects\rustybin`, using the Bash tool / Git Bash)

```bash
cd site/src
grep -rlZ -e '#0A0A0A' -e '#0F0F0F' -e '#2D2D2D' -e '#151515' -e '#222222' -e '#17191A' -e '#2F3032' -e '#222\]' . \
  | xargs -0 sed -i \
    -e 's/#0A0A0A/#0F1014/g' \
    -e 's/#0F0F0F/#0d0e11/g' \
    -e 's/#2D2D2D/#14151b/g' \
    -e 's/#151515/#1a1b20/g' \
    -e 's/#222222/#20222a/g' \
    -e 's/#17191A/#0F1014/g' \
    -e 's/#2F3032/#20222a/g' \
    -e 's/\[#222\]/[#20222a]/g'
cd ../..
```

Mapping rationale: `#0A0A0A`→`#0F1014` (card surface), `#0F0F0F`→`#0d0e11` (chrome), `#2D2D2D`→`#14151b` (page), `#151515`→`#1a1b20` (nested), `#222222`/`#222`/`#2F3032`→`#20222a` (border), `#17191A`→`#0F1014` (toast surface).

- [ ] **Step 2: Verify none remain**

Run: `grep -rn -e '#0A0A0A' -e '#0F0F0F' -e '#2D2D2D' -e '#151515' -e '#222222' -e '#17191A' -e '#2F3032' site/src`
Expected: no output (all replaced).

- [ ] **Step 3: Build + visual check**

Run: `npm run build` (expect success), then `npm run dev` and confirm dialogs (open Security Overview / Terms / Changelog from the footer), the language `Select` dropdown, switches, and toasts all render on near-black `#0F1014` surfaces with `#20222a` borders.

- [ ] **Step 4: Commit**

```bash
git add site/src
git commit -m "feat(theme): sweep hardcoded surface hexes to foxyz near-black palette"
```

---

## Task 3: Refine the Button to the foxyz treatment

**Files:**
- Modify: `site/src/components/ui/button.tsx`

- [ ] **Step 1: Soften the base radius and update the `default` variant**

In the `cva(...)` base string (line 8), change `rounded` to `rounded-md`.

Replace the `default` variant (line 12) with the orange-with-border-and-shadow treatment:

```ts
        default: "bg-primary text-primary-foreground border border-primary/60 shadow-[0_1px_2px_0_hsl(var(--primary)/0.3)] hover:bg-primary/90",
```

Leave the other variants (`destructive`, `outline`, `secondary`, `ghost`, `link`) unchanged — they already resolve through the new tokens.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add site/src/components/ui/button.tsx
git commit -m "feat(ui): foxyz-style primary button (orange, hairline border, soft shadow)"
```

---

## Task 4: Reusable GitHub link component (test-first)

A small, isolated presentational component so the repo URL lives in one place and is unit-testable without the router/fetch-heavy `Layout`.

**Files:**
- Create: `site/src/components/layout/GitHubLink.tsx`
- Test: `site/src/components/layout/__tests__/GitHubLink.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `site/src/components/layout/__tests__/GitHubLink.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GitHubLink, GITHUB_URL } from "../GitHubLink";

describe("GitHubLink", () => {
  it("links to the repo and opens safely in a new tab", () => {
    const { getByRole } = render(<GitHubLink />);
    const link = getByRole("link", { name: /github/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(GITHUB_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("shows a text label only when asked", () => {
    const { queryByText, rerender } = render(<GitHubLink />);
    expect(queryByText(/github/i)).toBeNull();
    rerender(<GitHubLink showLabel />);
    expect(queryByText(/github/i)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/layout/__tests__/GitHubLink.test.tsx`
Expected: FAIL — cannot resolve `../GitHubLink` (module not created yet).

- [ ] **Step 3: Implement the component**

Create `site/src/components/layout/GitHubLink.tsx`:

```tsx
import { Github } from "lucide-react";

export const GITHUB_URL = "https://github.com/EternityX/rustybin/";

type GitHubLinkProps = {
  showLabel?: boolean;
};

export function GitHubLink({ showLabel = false }: GitHubLinkProps) {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View source on GitHub"
      className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-white/30 hover:text-primary transition-colors"
    >
      <Github className="h-3.5 w-3.5" />
      {showLabel && <span className="hidden md:inline">GitHub</span>}
    </a>
  );
}
```

(The accessible name comes from `aria-label`, so the icon-only variant still matches `name: /github/i`. The repo stays `EternityX/rustybin` — only user-facing text is rebranded.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/layout/__tests__/GitHubLink.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add site/src/components/layout/GitHubLink.tsx site/src/components/layout/__tests__/GitHubLink.test.tsx
git commit -m "feat(layout): add reusable GitHubLink component with tests"
```

---

## Task 5: foxybin wordmark + GitHub link in the chrome (Layout)

**Files:**
- Modify: `site/src/components/layout/Layout.tsx`

- [ ] **Step 1: Import the GitHub icon and the GitHubLink component**

In the lucide import block (lines 3–13), add `Github` to the list. After the existing imports, add:

```tsx
import { GitHubLink } from "@/components/layout/GitHubLink";
```

- [ ] **Step 2: Replace the wordmark with the foxybin gradient**

Replace the wordmark span block (lines 143–148):

```tsx
              <span className="group text-[12px] uppercase tracking-wider font-bold transition-colors">
                <span className="brand-gradient">foxy</span>
                <span className="text-white group-hover:text-white/50 transition-colors">
                  bin
                </span>
              </span>
```

- [ ] **Step 3: Add the GitHub icon to the nav**

Immediately after the closing `</nav>` (line 221) and before `{headerExtra}`, insert:

```tsx
            <GitHubLink />
```

- [ ] **Step 4: Add the GitHub link to the footer**

In the footer row, immediately after the closing tag of the `<Changelog ... />` block (the element ending around line 315) and before the `{showByteCounter && (...)}` block, insert:

```tsx
          <GitHubLink showLabel />
```

- [ ] **Step 5: Build + visual check**

Run: `npm run build` (expect success), then `npm run dev`. Confirm: the header reads **foxy**(orange gradient)**bin**, a GitHub icon sits at the right of the top nav, and a GitHub link (icon + "GitHub" label on desktop) appears in the footer. Click both — each opens `https://github.com/EternityX/rustybin/` in a new tab.

- [ ] **Step 6: Commit**

```bash
git add site/src/components/layout/Layout.tsx
git commit -m "feat(layout): foxybin gradient wordmark + GitHub links in nav and footer"
```

---

## Task 6: foxybin wordmark in the Workspace header

**Files:**
- Modify: `site/src/pages/Workspace.tsx`

- [ ] **Step 1: Replace the workspace wordmark**

Open `site/src/pages/Workspace.tsx` and look at lines ~395–405 — it contains the same split wordmark as the old Layout (`rusty` + `bin` spans). Replace that wordmark markup with the foxybin gradient version (match the surrounding `<Link>`/`<span>` structure already there):

```tsx
              <span className="group text-[12px] uppercase tracking-wider font-bold transition-colors">
                <span className="brand-gradient">foxy</span>
                <span className="text-white group-hover:text-white/50 transition-colors">
                  bin
                </span>
              </span>
```

- [ ] **Step 2: Build + visual check**

Run: `npm run build` (expect success), then visit http://localhost:5173/w/new and confirm the workspace header shows the **foxybin** gradient wordmark.

- [ ] **Step 3: Commit**

```bash
git add site/src/pages/Workspace.tsx
git commit -m "feat(workspace): foxybin gradient wordmark"
```

---

## Task 7: Recolor the admin charts

**Files:**
- Modify: `site/src/components/admin/TimeSeriesChart.tsx`
- Modify: `site/src/components/admin/LanguageBreakdown.tsx`

- [ ] **Step 1: TimeSeriesChart — swap the mauve accent for orange**

Replace line 15: `const MAUVE = "hsl(348, 26%, 60%)";` with:

```ts
const MAUVE = "#ff6600";
```

Replace line 16: `const MAUVE_FILL = "hsla(348, 26%, 60%, 0.15)";` with:

```ts
const MAUVE_FILL = "rgba(255, 102, 0, 0.15)";
```

In the tooltip `contentStyle` (line ~48), change `backgroundColor: "#2D2D2D"` to:

```ts
                backgroundColor: "#0F1014",
```

(The grid/axis greys `#444`/`#555`/`#888`/`#999`/`#e0e0e0` read fine on the new dark background — leave them.)

- [ ] **Step 2: LanguageBreakdown — orange-led series palette + dark tooltip**

Replace the `COLORS` array (lines 14–23) with:

```ts
const COLORS = [
  "#ff6600",
  "#ff8c33",
  "#e65d2c",
  "#139a65",
  "#3b82f6",
  "#a855f7",
  "#eab308",
  "#22d3ee",
];
```

In the tooltip style (lines ~72–73), change `backgroundColor: "#2D2D2D"` → `"#0F1014"` and `border: "1px solid #555"` → `"1px solid #20222a"`.

- [ ] **Step 3: Build + visual check**

Run: `npm run build` (expect success). Then log in at `/admin/login` and confirm the dashboard charts use orange + the new series colors and dark tooltips. (If you don't have admin creds handy, a successful build is sufficient for this task.)

- [ ] **Step 4: Commit**

```bash
git add site/src/components/admin/TimeSeriesChart.tsx site/src/components/admin/LanguageBreakdown.tsx
git commit -m "feat(admin): recolor charts to foxyz orange palette"
```

---

## Task 8: Recolor markdown link/accent colors

The markdown stylesheet hardcodes the old rose hue (`hsl(348, ...)`) for links, hr, blockquote, and table accents. Shift them to orange.

**Files:**
- Modify: `site/src/components/paste/markdown-styles.css`

- [ ] **Step 1: Replace each rose value with its orange counterpart** (use replace-all for each distinct value)

| Find (all occurrences) | Replace with |
|---|---|
| `hsl(348, 26%, 60%)` | `hsl(24, 100%, 50%)` |
| `hsl(348, 26%, 65%)` | `hsl(24, 95%, 58%)` |
| `hsl(348, 26%, 70%)` | `hsl(24, 100%, 62%)` |
| `hsl(348, 30%, 72%)` | `hsl(24, 100%, 66%)` |
| `hsl(348, 30%, 75%)` | `hsl(24, 100%, 68%)` |
| `hsl(348, 26%, 45%)` | `hsl(24, 90%, 45%)` |

(The neutral text greys `#e6e6e6`/`#f0f0f0`/`#ccc`/`#999` and the GitHub-style admonition colors `#58a6ff`/`#3fb950`/`#a371f7`/`#d29922`/`#f85149` stay — they read correctly on the dark background.)

Verify none remain: `grep -n "348," site/src/components/paste/markdown-styles.css` → no output.

- [ ] **Step 2: Build + visual check**

Run: `npm run build` (expect success). In the editor, toggle the markdown **Preview** and confirm links, the `hr`, blockquote border, and table-header accents render orange.

- [ ] **Step 3: Commit**

```bash
git add site/src/components/paste/markdown-styles.css
git commit -m "feat(markdown): shift link/accent colors from rose to orange"
```

---

## Task 9: Rebrand user-facing text, theme-color, and favicon

Surgical, user-facing-only renames. **Do not** touch storage keys (`rustybin-prism-theme`, `rustybin-changelog-seen`), code comments, or domain URLs (`rustybin.net`, `api.rustybin.net`) — those are infrastructure/identifiers, out of scope per the spec.

**Files:**
- Modify: `site/index.html`
- Modify: `site/public/favicon.svg`
- Modify: `site/src/components/paste/SecurityInfo.tsx`
- Modify: `site/src/components/paste/Privacy.tsx`
- Modify: `site/src/components/paste/Terms.tsx`

- [ ] **Step 1: index.html — title + theme-color**

Replace line 7 `<title>Rustybin</title>` with `<title>foxybin</title>`. Add a theme-color meta inside `<head>` (e.g. right after the `<title>`):

```html
    <meta name="theme-color" content="#FF4800" />
```

- [ ] **Step 2: favicon.svg — recolor rose → orange**

In `site/public/favicon.svg`, change `fill="#AA8289"` to:

```
fill="#ff6600"
```

- [ ] **Step 3: Rebrand the three prose mentions**

- `SecurityInfo.tsx` line 26: change the dialog title text `How Rustybin ensures your data...` → `How foxybin ensures your data...` (replace only the word `Rustybin` → `foxybin`; leave the `rustybin.net` span on line 91 untouched — that's the domain).
- `Privacy.tsx` line 31: `Rustybin does not require...` → `foxybin does not require...`.
- `Terms.tsx` line 25: `By using Rustybin (the "Service")...` → `By using foxybin (the "Service")...`.

- [ ] **Step 4: Confirm only intended brand strings changed**

Run: `grep -rni "rustybin" site/src site/index.html`
Expected remaining hits ONLY: storage keys in `utils/prism-theme-utils.ts` and `components/paste/Changelog.tsx`, the comment in `lib/paste.ts`, and `rustybin.net`/`api.rustybin.net` domain URLs in `ApiEncryption.tsx` + the `rustybin.net` domain span in `SecurityInfo.tsx`. No remaining user-facing brand-name prose, title, or wordmark.

- [ ] **Step 5: Build + visual check**

Run: `npm run build` (expect success). Confirm the browser tab title is "foxybin", the favicon is orange, and the Security/Privacy/Terms dialogs read "foxybin".

- [ ] **Step 6: Commit**

```bash
git add site/index.html site/public/favicon.svg site/src/components/paste/SecurityInfo.tsx site/src/components/paste/Privacy.tsx site/src/components/paste/Terms.tsx
git commit -m "feat(brand): rebrand user-facing text to foxybin; orange favicon + theme-color"
```

---

## Task 10: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Lint, test, build**

Run, in order:
- `npm run lint` → expected: no new errors.
- `npm run test` → expected: all tests pass (existing `file-drop` suite + new `GitHubLink` suite).
- `npm run build` → expected: success.

- [ ] **Step 2: Visual checklist (`npm run dev`)**

Walk every surface and confirm the foxyz look + foxybin brand, with no leftover rose/grey:
- `/` paste page — editor, language select, advanced options (burn-after-read, expiration, quantum) tooltips, orange focus rings.
- Create a paste → toast appears on a dark surface; open the resulting `/:id` view.
- Markdown **Preview** — orange links/accents.
- `/w/new` workspace — sidebar, toolbar, foxybin wordmark, drag-and-drop a file.
- Footer dialogs: Security Overview, Terms, Privacy, API, Changelog — all near-black surfaces, "foxybin" prose.
- `/admin/login` and `/admin` (if creds available) — charts in orange palette.
- GitHub icon (nav) + GitHub link (footer) open the repo in a new tab.

- [ ] **Step 3: Confirm mainline is untouched**

Run: `git log --oneline master -1` and `git branch --show-current`
Expected: current branch is `003-foxybin-redesign`; `master` has no new redesign commits.

- [ ] **Step 4: Backend sanity (no changes expected)**

From repo root: `cargo build` (or `cargo check`)
Expected: success — confirms the frontend-only redesign didn't disturb the workspace build.

---

## Self-review notes (coverage check)

- Spec §1 Color system → Tasks 1, 2, 7, 8. Borders quieted + success/warning added → Task 1.
- Spec §2 Typography (Rubik) → Task 1.
- Spec §3 Layout language (flat surfaces, border dividers, near-black) → delivered via Tasks 1–3 + the chrome in Task 5; the paste-page "options" are an inline tooltip toolbar (not a side panel), so no risky structural rebuild — the bordered language comes from the palette + chrome, matching the approved direction.
- Spec §4 Signature flair (orange buttons, brand gradient wordmark, faint grain, icon tiles via tokens) → Tasks 1, 3, 5.
- Spec "GitHub link" → Tasks 4 (component + tests) + 5 (nav + footer).
- Spec §5 Files to change → covered across Tasks 1–9. Prism overrides were inspected and need no change (they reference CSS vars + a neutral scrollbar) — intentionally omitted.
- Spec §6 Pages affected → exercised in Task 10 checklist.
- Spec §7 Risks: Tailwind alpha modifiers → fixed in Task 1 Step 3; `--radius` undefined → defined in Task 1; hardcoded chart/surface colors → Tasks 2 + 7.
- Spec §8 Verification → Task 10.
