import DOMPurify from "dompurify";
import { marked } from "marked";
import { substitute } from "./templates";
import type { Monster } from "./types";

function assertBrowserDom(): void {
  if (typeof window === "undefined" || !window.document) {
    throw new Error("markdownToHtml requires a browser DOM so DOMPurify can sanitize the rendered HTML.");
  }
}

/** Substitute monster tokens, convert Markdown, and return sanitized HTML. */
export function markdownToHtml(markdown: string, monster: Monster): string {
  assertBrowserDom();
  return DOMPurify.sanitize(marked.parse(substitute(markdown, monster), { async: false }));
}

/** Alias used by preview consumers. Both paths return sanitized HTML. */
export const renderMarkdown = markdownToHtml;
