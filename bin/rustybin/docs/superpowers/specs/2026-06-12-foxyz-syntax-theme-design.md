# Foxyz editor background + syntax theme — design spec

**Date:** 2026-06-12
**Branch:** `003-foxybin-redesign` (same branch as the rest of the redesign)
**Status:** Awaiting review

## Context

The foxybin redesign restyled the app to the foxyz look, but the code editor still uses the
old default Prism theme (`prism-tomorrow`, background `#2d2d2d`) with CDN-fetched token
colors — it doesn't match the new near-black surfaces and has no orange identity. We want the
editor background to match the app's card surface (`#0F1014`) and a custom, legible syntax
theme that leads with the foxyz orange on keywords/control-flow.

How the editor theme works today (`site/src/utils/prism-theme-utils.ts`):
- `prismThemes` is an array of `{ value, label, background, textColor, source }`.
- The active theme is stored in `localStorage` under `rustybin-prism-theme`; the fallback
  default is `prism-tomorrow`.
- `loadPrismTheme(theme)` sets the `--prism-bg` / `--prism-text-color` CSS variables and the
  `.editor-container` background, then **fetches that theme's token-color CSS from a CDN**
  (jsdelivr `prismjs` or `prism-themes`), strips backgrounds/box-shadows/borders, and injects
  the result into a `#prism-theme-style` element.
- `usePrismTheme()` (consumed only by `PasteTextArea`) saves the theme to `localStorage` on
  mount and exposes `background` / `textColor`. **There is no theme-picker UI** — the default
  theme is effectively the only one users see.

## Decisions (locked during brainstorming)

- **Editor background = `#0F1014`**, base text `#e5e7eb` — delivered via the new theme's
  `background` / `textColor`.
- **New "Foxyz" theme = palette C** (orange keywords, teal types) — chosen for legibility
  over the more monochrome-orange options.
- **Foxyz becomes the default** for everyone. Because `usePrismTheme` already persisted
  `prism-tomorrow` for returning visitors, the **storage key is bumped**
  (`rustybin-prism-theme` → `foxybin-prism-theme`) so stale values are ignored and everyone
  lands on Foxyz.
- The other (CDN) themes stay in the array, just no longer default. **No theme-picker UI is
  added.**

## Approach

Token colors for Foxyz are defined **locally** (no CDN file exists for a custom theme). Extend
`loadPrismTheme` so a theme with `source: "custom"` injects a local CSS string into
`#prism-theme-style` and **skips the CDN fetch**; CDN themes (`source: "default" | "extra"`)
keep their current fetch path unchanged. The local CSS uses the same `.token.*` selectors a
Prism theme uses, scoped under `[data-prism-theme="prism-foxyz"]` (the body already gets
`data-prism-theme` set in `loadPrismTheme`) to avoid leaking into other themes.

## Token → color mapping (palette C)

Background `#0F1014`; base/variable text `#e5e7eb`.

| Prism token classes | Color | Note |
|---|---|---|
| `keyword`, `atrule`, `selector`, `tag`, `keyword.control` | `#ff6600` | keyword **bold** |
| `class-name`, `builtin`, `property`, `attr-name`, `namespace` | `#5ed3c0` | types/teal (namespace at 0.7 opacity) |
| `function`, `function-variable` | `#ffc06a` | amber |
| `string`, `char`, `attr-value`, `regex`, `inserted` | `#8ee3b6` | green |
| `number`, `boolean`, `constant`, `symbol` | `#d3b1ff` | soft purple |
| `comment`, `prolog`, `doctype`, `cdata` | `#5f6672` | italic |
| `operator`, `entity`, `url` | `#9aa0ae` | |
| `punctuation` | `#8a90a0` | |
| `deleted` | `#d72d3f` | |
| `important`, `bold` | bold | `italic` → italic |

## Files to change

- `site/src/utils/prism-theme-utils.ts`:
  - Add the Foxyz theme entry: `{ value: "prism-foxyz", label: "Foxyz", background: "#0F1014", textColor: "#e5e7eb", source: "custom" }` (place it first so it reads as the primary option).
  - Add a `FOXYZ_THEME_CSS` string with the `.token.*` rules above, scoped under
    `[data-prism-theme="prism-foxyz"]`.
  - In `loadPrismTheme`: when the resolved theme's `source === "custom"`, set the CSS vars +
    editor colors as today, inject `FOXYZ_THEME_CSS` into `#prism-theme-style`, and return
    early (no CDN fetch). Keep the existing fetch path for default/extra themes.
  - Change `STORAGE_KEY` to `"foxybin-prism-theme"` and the `getStoredPrismTheme` fallback +
    the SSR/`setTheme`-error fallbacks from `"prism-tomorrow"` to `"prism-foxyz"`.

## Out of scope

- No theme-picker UI. No backend/API changes. No changes to other themes' definitions beyond
  losing default status. The `markdown-styles.css` / rendered-markdown code blocks are not part
  of the editor Prism theme and are left as-is.

## Risks

- **Token-class coverage varies by language** (e.g. Rust primitive types may tokenize as
  `keyword` not `class-name`). The mapping targets the common Prism classes; exact per-language
  fidelity is best-effort and verified by eyeballing several languages.
- **CSS specificity / `prism-overrides.css`** forces token backgrounds transparent with
  `!important`; the Foxyz color rules set only `color`, so they coexist. Scope under
  `[data-prism-theme="prism-foxyz"]` to avoid affecting other themes if switched.

## Verification

- `npm --prefix site run dev` → on the create page the editor background is `#0F1014`; type/paste
  TypeScript, Rust, JSON, and Markdown and confirm: keywords orange (bold), types teal,
  functions amber, strings green, numbers purple, comments muted-italic; text is legible.
- Clear `localStorage` (or load fresh) and confirm Foxyz is applied by default (no `prism-tomorrow`).
- `npm --prefix site run build` and `npm --prefix site test` pass.
