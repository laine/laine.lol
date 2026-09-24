# foxybin redesign — design spec

**Date:** 2026-06-12
**Branch:** `003-foxybin-redesign` (off `master`; `main`/`master` untouched)
**Status:** Awaiting review

## Context

rustybin is a dark, minimal pastebin (React 18 + Vite + Tailwind v3 + shadcn/ui) whose
current accent is a dusty-rose `hsl(348 26% 60%)`. The owner wants it restyled to match the
look and colors of **foxyz.net** (local source at `E:\Projects\foxyz`) and rebranded to
**foxybin**. The goal is a faithful foxyz-family visual identity — near-black surfaces, an
orange brand, Rubik type, and a flush border-divided layout — applied to the existing app
without changing any features, backend, or routing. All work happens on a dedicated branch
so the mainline is unaffected.

The theme is already centralized (HSL CSS variables in `site/src/index.css`, consumed via
`hsl(var(--x))` in `site/tailwind.config.ts`), so this is a **theme swap + a small
signature layer + a rebrand**, not a rewrite.

## Decisions (locked during brainstorming)

- **Scope:** Reskin **plus signature flair** (the foxyz "tells"), keeping rustybin's
  tool-focused layout — not a marketing-site overhaul.
- **Type:** **Rubik** for UI (replaces Inter); **JetBrains Mono** unchanged for code.
- **Palette:** the *actual* values used in foxyz's pages (`app/routes/index.tsx`,
  `app/components/features.tsx`), which differ from the raw design tokens — see table.
- **Layout:** flush **bento grid** — no inter-card gaps or outer padding; 1px borders are
  the only separators; adjacent row heights aligned so dividers run continuously.
- **Rebrand:** rustybin → **foxybin**, **user-facing only** (wordmark, titles, meta,
  favicon, frontend copy, README/changelog). Repo name, Rust crate, directories, and code
  identifiers are left as-is.
- **Wordmark:** `foxy` in the orange gradient + `bin` in near-white.
- **GitHub link:** a GitHub **icon link** in the nav (top-right) and footer, opening
  `https://github.com/EternityX/rustybin/` in a new tab — icon only, no dedicated page.
  (Target stays the `rustybin` repo; only user-facing text is rebranded.)

## Non-goals / out of scope

- No backend (Rust/Axum), API, routing, or data-model changes.
- No renaming of the repo, `Cargo` crate, directories, or code identifiers.
- None of foxyz's heavy motion: animated scrolling perlin noise, conic border-trace,
  seed-shine, slogan bubbles, WebGL (Unicorn) waves, or marketing hero chrome.
- No light-mode work — app is dark-only (forces `.dark`); the `.dark` block is what renders.

## 1. Color system

**Source of truth = hex** (below). Implementation note: the existing variables hold an
`H S% L%` triplet consumed by `hsl(var(--x))`, so each hex is **converted to its HSL triplet**
and dropped into the variable — keeping every existing component class working unchanged.
Verify each converted value renders identical to the hex.

| rustybin variable | New value (foxyz) | Role |
|---|---|---|
| `--background` + body bg (was `#2D2D2D`) | `#14151b` | page |
| header/nav + footer/status bar | `#0d0e11` | chrome |
| `--card`, `--popover` | `#0F1014` | cards/surfaces |
| `--secondary`, `--muted`, `--accent` | `#1a1b20` | nested fields/hover |
| `--border`, `--input` | `#20222a` | **quiet** dividers (no longer the accent) |
| `--foreground`, card/popover fg | `#e5e7eb` | headings / primary text |
| `--muted-foreground` | `#888b98` | muted text |
| body paragraph copy | `#a1a1aa` (zinc-400) | long-form body |
| `--primary`, `--ring` | `#ff6600` | action / focus / active |
| `--primary-foreground` | `#ffffff` | text on orange |
| `--destructive` | `#d72d3f` | danger |
| add `--success` / `--warning` | `#139a65` / `#eab308` | toast/state accents |
| sidebar-* (workspace) | bg `#0d0e11`, border `#20222a`, primary/ring `#ff6600`, accent `#1a1b20` | workspace chrome |

**Brand gradient.** A `.brand-gradient` utility (`linear-gradient(180deg,#FF6600,#dc3e00)`
+ `bg-clip-text`) for the wordmark and accent words — matching foxyz's `from-[#FF6600]
to-[#dc3e00]`.

**Borders go quiet.** Orange is reserved for action / focus / active / links; borders are
the neutral `#20222a`. This is the biggest behavioral change from the current theme, where
`--border` equals the accent.

## 2. Typography

- Replace the Inter Google-Fonts import with **Rubik** (`300;400;500;600;700;800`); keep the
  **JetBrains Mono** import. Update the `sans` stack in `tailwind.config.ts` to lead with
  `Rubik` (keep `system-ui` fallbacks); `mono` unchanged.

## 3. Layout language

- **Flush bento:** remove gaps/outer padding between panels; sections sit edge-to-edge,
  separated only by 1px `#20222a` borders. Modest internal cell padding for legibility.
- **Aligned dividers:** rows that sit across a shared horizontal line (e.g. editor toolbar ↔
  options-panel header) get an identical row height via `height` + `box-sizing:border-box`
  so the divider is continuous.
- **CTA as a full-width bar** (flush, `border-top`, flat orange) instead of a floating
  button, to suit the no-gap density. (Pill remains available for non-flush contexts.)
- **Status bar footer** (e.g. Markdown · UTF-8 · lines · ✓ Encrypted) in the same border
  language.

## 4. Signature flair

**In:** flat orange pill/bar primary buttons (1.5px `primary/55` border, subtle shadow,
optional `btn-shine` sweep); near-transparent secondary buttons with orange text (`#f76d29`)
+ orange border; flat near-black cards (`#0F1014`) with `#20222a` border + soft drop-shadow;
orange icon tiles (`primary/10` fill, `primary/25` border, rounded) with a faint hover
`drop-shadow` glow; gradient-orange wordmark/accent words; **optional, very faint static**
page grain (drop if it reads noisy).

**Out:** everything under Non-goals (no heavy/animated effects).

## GitHub link

- A GitHub icon in the nav (top-right, next to the nav links) and in the footer/status bar,
  styled in the muted/foreground hover language (gray → near-white/orange on hover).
- Both link to `https://github.com/EternityX/rustybin/` with `target="_blank"` and
  `rel="noopener noreferrer"`.
- Use the existing icon set — `lucide-react`'s `Github` glyph if it's already a dependency,
  otherwise a small inline SVG. (Verify during implementation.)

## 5. Files to change (all under `site/`)

- `src/index.css` — palette (`:root` + `.dark`), body bg, font import, `.brand-gradient`,
  button/card/icon-tile helpers, optional grain.
- `tailwind.config.ts` — `sans` stack (Rubik); add `--success`/`--warning` color mappings;
  add a `4xl` border-radius (or use `rounded-full`) for pills; if Tailwind opacity utilities
  (`bg-primary/20`) don't apply, switch color defs to `hsl(var(--x) / <alpha-value>)`.
- `src/components/ui/button.tsx` — primary (orange pill/bar) + secondary (orange-text) variants.
- `src/components/ui/card.tsx` — flat near-black + border + drop-shadow (mostly via vars).
- `src/components/layout/Layout.tsx` — foxybin gradient wordmark, nav, flush borders, status
  bar, and the GitHub icon link (nav + footer).
- `src/components/paste/*` — editor toolbar + options panel as flush, divider-aligned cells;
  `MarkdownToolbar`; restyle the "quantum-resistant" badge to the neutral card + gradient-dot
  treatment.
- `src/components/paste/markdown-styles.css` — link / code-block / heading / blockquote colors.
- `src/styles/prism-overrides.css` — background, scrollbar, and (optional) orange keyword accent.
- `src/components/admin/*` (`StatsCards`, `TimeSeriesChart`, `LanguageBreakdown`) — chart
  series, grid, and axis colors to the foxyz palette.
- `public/favicon.svg` — recolor rose → orange (`#ff6600`/gradient).
- `index.html` — `<title>` → foxybin, `theme-color` → `#FF4800`, OG/meta copy.
- User-facing `rustybin` strings in `src/**` JSX/copy → `foxybin` (leave code identifiers);
  `README.md` and `src/components/paste/Changelog.tsx` copy as needed.

## 6. Pages affected

Index (paste create/view/edit), Workspace, AdminLogin, AdminDashboard, all dialogs/modals
(Terms, Privacy, SecurityInfo, ApiEncryption, Changelog), and toasts.

## 7. Risks & mitigations

- **Tailwind alpha modifiers** (`bg-primary/20`) need the `<alpha-value>` channel form; if
  current defs break opacity, update the color definitions in `tailwind.config.ts`.
- **`rounded-4xl`** isn't a Tailwind v3 default — add to config or use `rounded-full`.
- **Hardcoded chart colors** (Recharts) must be found and updated, not just the CSS vars.
- **Hardcoded surface colors** elsewhere (e.g. `bg-[#0A0A0A]`, `border-[#222222]`,
  `bg-[#2D2D2D]`) bypass the variables — grep and replace these so nothing keeps the old palette.

## 8. Verification

- `cd site && npm run dev`; eyeball `/`, `/:id`, `/w/new`, `/admin/login`, `/admin`; open each
  dialog, the markdown preview, and trigger a toast (create a paste). Check: orange focus
  rings, button variants, continuous dividers, foxybin wordmark, workspace drag/drop, and the
  GitHub icon link (nav + footer) opening the repo in a new tab.
- `npm run build` (typecheck) and lint; run existing `site/src/lib/__tests__`.
- `cargo test && cargo clippy` as a no-change sanity check (no backend edits).
- Confirm all commits land on `003-foxybin-redesign` only; `master`/`main` unchanged.
