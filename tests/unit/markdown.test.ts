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
