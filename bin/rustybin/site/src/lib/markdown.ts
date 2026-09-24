import MarkdownIt from "markdown-it";
import { full as emoji } from "markdown-it-emoji";
import sub from "markdown-it-sub";
import sup from "markdown-it-sup";
import ins from "markdown-it-ins";
import mark from "markdown-it-mark";
import footnote from "markdown-it-footnote";
import deflist from "markdown-it-deflist";
import abbr from "markdown-it-abbr";
import container from "markdown-it-container";
import taskLists from "markdown-it-task-lists";
import anchor from "markdown-it-anchor";
import DOMPurify from "dompurify";
import Prism from "prismjs";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Initialize markdown-it with full features
const md = new MarkdownIt({
  html: false,
  xhtmlOut: false,
  breaks: false,
  langPrefix: "language-",
  linkify: true,
  typographer: true,

  // Syntax highlighting with Prism.js
  // markdown-it wraps the return value in <pre><code class="language-X">...</code></pre>
  // so we return only the highlighted inner HTML
  highlight(str: string, lang: string): string {
    if (lang && Prism.languages[lang]) {
      try {
        return Prism.highlight(str, Prism.languages[lang], lang);
      } catch {
        // fall through
      }
    }
    return escapeHtml(str);
  },
});

// Load plugins
md.use(emoji);
md.use(sub);
md.use(sup);
md.use(ins);
md.use(mark);
md.use(footnote);
md.use(deflist);
md.use(abbr);
md.use(taskLists, { enabled: true, label: true });
md.use(anchor, { permalink: false });

// Custom containers: ::: warning ... :::
const containerTypes = ["warning", "tip", "note", "important", "caution", "danger"];
for (const type of containerTypes) {
  md.use(container, type, {
    render(tokens: { nesting: number }[], idx: number) {
      if (tokens[idx].nesting === 1) {
        return `<div class="md-container md-container-${type}"><p class="md-container-title">${type}</p>\n`;
      }
      return "</div>\n";
    },
  });
}

// Override fence renderer to add a language label badge
const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  const lang = token.info.trim().split(/\s+/)[0];
  const rendered = defaultFence(tokens, idx, options, env, self);

  if (lang) {
    const label = `<span class="code-lang-label">${escapeHtml(lang)}</span>`;
    return `<div class="code-block-wrapper">${label}${rendered}</div>`;
  }
  return `<div class="code-block-wrapper">${rendered}</div>`;
};

// Make external links open in new tab
const defaultLinkOpen =
  md.renderer.rules.link_open ??
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const href = tokens[idx].attrGet("href");
  if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener noreferrer");
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

// Add lazy loading to images
const defaultImage =
  md.renderer.rules.image ??
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.image = function (tokens, idx, options, env, self) {
  tokens[idx].attrSet("loading", "lazy");
  return defaultImage(tokens, idx, options, env, self);
};

/**
 * Render markdown to sanitized HTML.
 *
 * Full spec support:
 * - CommonMark core
 * - GFM: tables, strikethrough, autolinks, task lists
 * - Typographer: smart quotes, dashes, ellipsis, (c)(r)(tm)
 * - Emoji shortcodes: :wink: :cry: :laughing:
 * - Subscript: H~2~O   Superscript: 19^th^
 * - Inserted text: ++inserted++   Marked text: ==highlighted==
 * - Footnotes: [^1] and [^1]: definition
 * - Definition lists: Term / :   Definition
 * - Abbreviations: *[HTML]: Hyper Text Markup Language
 * - Custom containers: ::: warning ... :::
 * - Task lists: - [x] done / - [ ] todo
 * - Heading anchor IDs
 * - Fenced code blocks with Prism.js syntax highlighting
 * - Linkify: auto-link bare URLs
 */
export function renderMarkdown(source: string): string {
  const rawHtml = md.render(source);
  return DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: [
      "pre", "code", "input", "section", "sup", "sub",
      "details", "summary", "mark", "ins", "del",
      "dl", "dt", "dd", "abbr", "s",
    ],
    ADD_ATTR: [
      "class", "target", "rel", "type", "checked", "disabled",
      "loading", "id", "href", "title", "open",
      "data-footnote-ref", "data-footnote-backref",
      "aria-label", "role", "for",
    ],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "style"],
    FORBID_ATTR: [
      "onerror", "onclick", "onload", "onmouseover", "onfocus", "onblur",
    ],
  });
}
