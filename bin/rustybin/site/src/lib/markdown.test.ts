import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  describe("XSS sanitization", () => {
    // markdown-it with html:false escapes HTML to entities, so tags won't execute
    // DOMPurify provides a second layer of defense

    it("escapes script tags (not executable)", () => {
      const html = renderMarkdown('<script>alert("xss")</script>');
      expect(html).not.toContain("<script");
    });

    it("escapes onerror event handlers", () => {
      const html = renderMarkdown('<img src=x onerror="alert(1)">');
      // html:false escapes the tag entirely
      expect(html).not.toMatch(/<img[^>]*onerror/);
    });

    it("escapes onclick event handlers", () => {
      const html = renderMarkdown('<div onclick="alert(1)">click</div>');
      expect(html).not.toMatch(/<div[^>]*onclick/);
    });

    it("does not create executable iframe elements", () => {
      const html = renderMarkdown('<iframe src="https://evil.com"></iframe>');
      expect(html).not.toContain("<iframe");
    });

    it("does not link javascript: URLs", () => {
      const html = renderMarkdown("[click](javascript:alert(1))");
      // markdown-it doesn't linkify javascript: protocol
      expect(html).not.toMatch(/href="javascript:/);
    });

    it("escapes object and embed tags", () => {
      const html = renderMarkdown('<object data="evil.swf"></object><embed src="evil.swf">');
      expect(html).not.toContain("<object");
      expect(html).not.toContain("<embed");
    });

    it("escapes form elements", () => {
      const html = renderMarkdown('<form action="https://evil.com"><input></form>');
      expect(html).not.toContain("<form");
    });
  });

  describe("basic markdown", () => {
    it("renders headings", () => {
      const html = renderMarkdown("# Hello\n## World");
      expect(html).toContain("<h1");
      expect(html).toContain("Hello");
      expect(html).toContain("<h2");
      expect(html).toContain("World");
    });

    it("renders bold and italic", () => {
      const html = renderMarkdown("**bold** and *italic*");
      expect(html).toContain("<strong>bold</strong>");
      expect(html).toContain("<em>italic</em>");
    });

    it("renders unordered lists", () => {
      const html = renderMarkdown("- item 1\n- item 2");
      expect(html).toContain("<ul");
      expect(html).toContain("<li");
    });

    it("renders ordered lists", () => {
      const html = renderMarkdown("1. first\n2. second");
      expect(html).toContain("<ol");
    });

    it("renders links with target=_blank for external", () => {
      const html = renderMarkdown("[Google](https://google.com)");
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it("renders fenced code blocks", () => {
      const html = renderMarkdown("```\nconst x = 1;\n```");
      expect(html).toContain("<pre");
      expect(html).toContain("<code");
    });

    it("renders tables", () => {
      const html = renderMarkdown("| A | B |\n|---|---|\n| 1 | 2 |");
      expect(html).toContain("<table");
      expect(html).toContain("<th");
      expect(html).toContain("<td");
    });

    it("renders blockquotes", () => {
      const html = renderMarkdown("> quoted text");
      expect(html).toContain("<blockquote");
    });

    it("renders inline code", () => {
      const html = renderMarkdown("use `const` for variables");
      expect(html).toContain("<code");
    });

    it("renders horizontal rules", () => {
      const html = renderMarkdown("---");
      expect(html).toContain("<hr");
    });

    it("renders strikethrough", () => {
      const html = renderMarkdown("~~deleted~~");
      expect(html).toContain("<s>");
      expect(html).toContain("deleted");
    });

    it("renders images with lazy loading", () => {
      const html = renderMarkdown("![alt](https://img.example.com/pic.png)");
      expect(html).toContain("<img");
      expect(html).toContain('loading="lazy"');
    });
  });

  describe("GFM and extended features", () => {
    it("renders task lists", () => {
      const html = renderMarkdown("- [x] done\n- [ ] todo");
      expect(html).toContain("checkbox");
      expect(html).toContain("done");
      expect(html).toContain("todo");
    });

    it("renders code blocks with language labels", () => {
      const html = renderMarkdown("```rust\nfn main() {}\n```");
      expect(html).toContain("code-block-wrapper");
      expect(html).toContain("code-lang-label");
      expect(html).toContain("rust");
    });

    it("auto-links bare URLs (linkify)", () => {
      const html = renderMarkdown("Visit https://example.com for info");
      expect(html).toContain("<a");
      expect(html).toContain("https://example.com");
    });

    it("renders heading IDs for anchor links", () => {
      const html = renderMarkdown("## My Heading");
      expect(html).toContain('id="my-heading"');
    });

    it("renders footnotes", () => {
      const html = renderMarkdown("Text[^1]\n\n[^1]: Footnote content");
      expect(html).toContain("Footnote content");
    });

    it("renders emoji shortcodes", () => {
      const html = renderMarkdown("Hello :wink:");
      // emoji plugin converts to unicode emoji
      expect(html).not.toContain(":wink:");
    });

    it("renders subscript", () => {
      const html = renderMarkdown("H~2~O");
      expect(html).toContain("<sub>");
      expect(html).toContain("2");
    });

    it("renders superscript", () => {
      const html = renderMarkdown("19^th^");
      expect(html).toContain("<sup>");
      expect(html).toContain("th");
    });

    it("renders inserted text", () => {
      const html = renderMarkdown("++inserted++");
      expect(html).toContain("<ins>");
      expect(html).toContain("inserted");
    });

    it("renders marked/highlighted text", () => {
      const html = renderMarkdown("==highlighted==");
      expect(html).toContain("<mark>");
      expect(html).toContain("highlighted");
    });

    it("renders definition lists", () => {
      const html = renderMarkdown("Term 1\n\n:   Definition 1");
      expect(html).toContain("<dl>");
      expect(html).toContain("<dt>");
      expect(html).toContain("<dd>");
    });

    it("renders abbreviations", () => {
      const html = renderMarkdown("This is HTML\n\n*[HTML]: Hyper Text Markup Language");
      expect(html).toContain("<abbr");
      expect(html).toContain("Hyper Text Markup Language");
    });

    it("renders custom containers", () => {
      const html = renderMarkdown("::: warning\n*here be dragons*\n:::");
      expect(html).toContain("md-container");
      expect(html).toContain("md-container-warning");
      expect(html).toContain("dragons");
    });

    it("applies typographic replacements", () => {
      const html = renderMarkdown("(c) (tm) -- ---");
      expect(html).toContain("\u00A9"); // ©
      expect(html).toContain("\u2122"); // ™
      expect(html).toContain("\u2013"); // –
      expect(html).toContain("\u2014"); // —
    });

    it("applies smart quotes", () => {
      const html = renderMarkdown('"double" and \'single\'');
      expect(html).toContain("\u201C"); // "
      expect(html).toContain("\u2018"); // '
    });
  });
});
