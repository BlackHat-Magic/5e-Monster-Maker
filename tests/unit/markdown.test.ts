// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { normalizeMonster } from "../../src/lib/monster/defaults";
import { markdownToHtml } from "../../src/lib/monster/markdown";

describe("markdown preview sanitization", () => {
  it("throws a clear error without a browser DOM and restores globals", () => {
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");

    try {
      Object.defineProperty(globalThis, "window", { configurable: true, value: undefined, writable: true });
      Object.defineProperty(globalThis, "document", { configurable: true, value: undefined, writable: true });
      expect(() => markdownToHtml("text", normalizeMonster({}))).toThrow(
        "markdownToHtml requires a browser DOM",
      );
    } finally {
      if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
      else Reflect.deleteProperty(globalThis, "window");
      if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
      else Reflect.deleteProperty(globalThis, "document");
    }
  });

  it("removes dangerous HTML elements and attributes through DOMPurify", () => {
    const html = markdownToHtml(
      '<form action="javascript:alert(1)">Submit</form><img src="x" onerror="alert(1)">',
      normalizeMonster({}),
    );

    expect(html).toContain("<form>");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("onerror");
  });
});

describe("markdown subset renderer", () => {
  const monster = normalizeMonster({});

  it("renders bold, italic, and bold-italic lead-ins used by stat blocks", () => {
    expect(markdownToHtml("**Armor Class** 22", monster)).toBe("<p><strong>Armor Class</strong> 22</p>\n");
    expect(markdownToHtml("*gargantuan dragon, chaotic evil*", monster)).toBe(
      "<p><em>gargantuan dragon, chaotic evil</em></p>\n",
    );
    expect(markdownToHtml("***Claw.*** Melee Weapon Attack.", monster)).toBe(
      "<p><strong><em>Claw.</em></strong> Melee Weapon Attack.</p>\n",
    );
  });

  it("renders unordered and ordered lists used by generated descriptions", () => {
    expect(markdownToHtml("- One\n- Two", monster)).toBe("<ul>\n<li>One</li>\n<li>Two</li>\n</ul>\n");
    expect(markdownToHtml("1. First\n2. Second", monster)).toBe("<ol>\n<li>First</li>\n<li>Second</li>\n</ol>\n");
  });

  it("renders code spans, links, and images", () => {
    expect(markdownToHtml("`+5 to hit`", monster)).toBe("<p><code>+5 to hit</code></p>\n");
    expect(markdownToHtml("[darkness](https://example.com/darkness)", monster)).toBe(
      '<p><a href="https://example.com/darkness">darkness</a></p>\n',
    );
    expect(markdownToHtml("![sigil](https://example.com/sigil.png)", monster)).toContain(
      '<img src="https://example.com/sigil.png" alt="sigil">',
    );
  });

  it("leaves asterisks, ampersands, and entities alone when they are not markup", () => {
    expect(markdownToHtml("2 * 3 = 6", monster)).toBe("<p>2 * 3 = 6</p>\n");
    expect(markdownToHtml("foo*bar*", monster)).toBe("<p>foo*bar*</p>\n");
    expect(markdownToHtml("Fish & chips &amp; salsa", monster)).toBe("<p>Fish &amp; chips &amp; salsa</p>\n");
  });

  it("passes authored HTML spans through for DOMPurify", () => {
    expect(
      markdownToHtml('<span data-preview-section="authored">Nested marker</span>', monster),
    ).toContain('<span data-preview-section="authored">Nested marker</span>');
  });

  it("leaves intentionally unsupported syntax as literal text", () => {
    expect(markdownToHtml("# Title", monster)).toBe("<p># Title</p>\n");
    expect(markdownToHtml("_italic_", monster)).toBe("<p>_italic_</p>\n");
    expect(markdownToHtml("---", monster)).toBe("<p>---</p>\n");
    expect(markdownToHtml("> quoted", monster)).toBe("<p>&gt; quoted</p>\n");
  });
});
