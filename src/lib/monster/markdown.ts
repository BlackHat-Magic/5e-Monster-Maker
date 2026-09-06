import DOMPurify from "dompurify";
import { substitute } from "./templates";
import type { Monster } from "./types";

function assertBrowserDom(): void {
  if (typeof window === "undefined" || !window.document) {
    throw new Error("markdownToHtml requires a browser DOM so DOMPurify can sanitize the rendered HTML.");
  }
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}

function isWhitespace(character: string | undefined): boolean {
  // The start and end of the text count as whitespace for flanking purposes.
  return character === undefined || /[\s]/.test(character);
}

function isPunctuation(character: string | undefined): boolean {
  return character !== undefined && /[!-/:-@[-`{-~]/.test(character);
}

// Delimiter runs follow the CommonMark flanking rules so inputs like
// `2 * 3` or `foo*bar*` render literally instead of toggling emphasis.
function flanking(before: string | undefined, after: string | undefined): { left: boolean; right: boolean } {
  return {
    left: !isWhitespace(after) && (!isPunctuation(after) || isWhitespace(before) || isPunctuation(before)),
    right: !isWhitespace(before) && (!isPunctuation(before) || isWhitespace(after) || isPunctuation(after)),
  };
}

function canOpenEmphasis(before: string | undefined, after: string | undefined): boolean {
  const { left, right } = flanking(before, after);
  return left && (!right || isPunctuation(after));
}

function canCloseEmphasis(before: string | undefined, after: string | undefined): boolean {
  const { left, right } = flanking(before, after);
  return right && (!left || isPunctuation(before));
}

function findClosingRun(text: string, from: number, run: string): number {
  let index = text.indexOf(run, from);
  while (index >= 0) {
    const before = text[index - 1];
    const after = text[index + run.length];
    if (run === "*" && (before === "*" || after === "*")) {
      index = text.indexOf(run, index + 1);
      continue;
    }
    if (canCloseEmphasis(before, after)) return index;
    index = text.indexOf(run, index + 1);
  }
  return -1;
}

function parseLinkAt(text: string, index: number): { html: string; next: number } | null {
  const image = text[index] === "!";
  let cursor = index + (image ? 2 : 1);
  if (text[cursor - 1] !== "[") return null;
  const labelEnd = text.indexOf("]", cursor);
  if (labelEnd < 0) return null;
  if (text[labelEnd + 1] !== "(") return null;
  const hrefEnd = text.indexOf(")", labelEnd + 2);
  if (hrefEnd < 0) return null;
  const inside = text.slice(labelEnd + 2, hrefEnd).trim();
  const href = inside.split(/\s+/)[0] ?? "";
  if (!href || /[<>]/.test(href) || href.includes("(")) return null;
  const label = parseInline(text.slice(cursor, labelEnd));
  const tag = image
    ? `<img src="${escapeAttribute(href)}" alt="${escapeAttribute(text.slice(cursor, labelEnd))}">`
    : `<a href="${escapeAttribute(href)}">${label}</a>`;
  return { html: tag, next: hrefEnd + 1 };
}

function parseInline(text: string): string {
  let output = "";
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    const after = text[index + 1];

    if (character === "`") {
      const end = text.indexOf("`", index + 1);
      if (end > index + 1 && !text.slice(index + 1, end).includes("\n")) {
        output += `<code>${escapeText(text.slice(index + 1, end))}</code>`;
        index = end + 1;
        continue;
      }
      output += escapeText(character);
      index += 1;
      continue;
    }

    if (character === "[" || (character === "!" && after === "[")) {
      const link = parseLinkAt(text, index);
      if (link) {
        output += link.html;
        index = link.next;
        continue;
      }
      output += escapeText(character);
      index += 1;
      continue;
    }

    if (character === "<") {
      const comment = text.startsWith("<!--", index) ? text.indexOf("-->", index + 4) : -1;
      if (comment >= 0) {
        output += text.slice(index, comment + 3);
        index = comment + 3;
        continue;
      }
      const tag = text.slice(index).match(/^<\/?[A-Za-z][^<>]*>?/);
      if (tag) {
        output += tag[0].endsWith(">") ? tag[0] : escapeText(tag[0]);
        index += tag[0].length;
        continue;
      }
      output += escapeText(character);
      index += 1;
      continue;
    }

    if (character === "*") {
      const run = text.startsWith("***", index) ? "***" : text.startsWith("**", index) ? "**" : "*";
      if (canOpenEmphasis(text[index - 1], text[index + run.length])) {
        const end = findClosingRun(text, index + run.length, run);
        if (end >= 0) {
          const inner = parseInline(text.slice(index + run.length, end));
          output += run === "***" ? `<strong><em>${inner}</em></strong>` : run === "**" ? `<strong>${inner}</strong>` : `<em>${inner}</em>`;
          index = end + run.length;
          continue;
        }
      }
      output += escapeText(character);
      index += 1;
      continue;
    }

    if (character === "&") {
      const entity = text.slice(index).match(/^&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/);
      if (entity) {
        output += entity[0];
        index += entity[0].length;
        continue;
      }
      output += "&amp;";
      index += 1;
      continue;
    }

    output += character === ">" ? "&gt;" : character;
    index += 1;
  }
  return output;
}

const LIST_ITEM_RE = /^(?:[*+-]|\d+[.)])\s+(.*)$/;
const HTML_BLOCK_RE = /^<(?:[A-Za-z!?/])/;

function renderListBlock(lines: string[], ordered: boolean): string {
  const loose = lines.some((line) => line.trim().length === 0);
  const items: string[] = [];
  let current: string[] = [];
  const flush = (): void => {
    const html = parseInline(current.join("\n"));
    items.push(loose ? `<li><p>${html}</p></li>` : `<li>${html}</li>`);
    current = [];
  };
  for (const line of lines) {
    const match = line.match(LIST_ITEM_RE);
    if (match && current.length > 0) flush();
    current.push(match ? match[1] : line);
  }
  if (current.length > 0) flush();
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>\n${items.join("\n")}\n</${tag}>`;
}

function isListMarker(line: string): boolean {
  return LIST_ITEM_RE.test(line);
}

function isOrderedMarker(line: string): boolean {
  return /^\d+[.)]\s+/.test(line);
}

/** Minimal Markdown renderer covering the syntax monster content actually uses.
 *
 * Supported: paragraphs, `**bold**`, `*italic*`, `***bold italic***`,
 * `` `code` ``, `[label](href)` / `![alt](src)`, `-`/`+`/`*` unordered lists,
 * `1.`/`1)` ordered lists, `&entities;`, and raw HTML blocks passed through
 * untouched for DOMPurify (the sanitizer, not this parser, decides what is
 * safe). Deliberately unsupported — rendered as literal text, never
 * formatted: `#`/`##` headings, `>` blockquotes, `---` rules, tables,
 * autolinks, reference-style links, and `_`/`__` emphasis. User content in
 * the wild (action names, attack strings, spell lists) only ever exercises
 * the supported set, so dropping full-CommonMark parity saves ~12 KB of
 * parser without changing any rendered stat block.
 */
export function renderMarkdownSource(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;
  while (index < lines.length) {
    while (index < lines.length && lines[index].trim().length === 0) index += 1;
    if (index >= lines.length) break;
    if (HTML_BLOCK_RE.test(lines[index].trimStart())) {
      const start = index;
      while (index < lines.length && lines[index].trim().length !== 0) index += 1;
      blocks.push(lines.slice(start, index).join("\n"));
      continue;
    }
    if (isListMarker(lines[index].trimStart())) {
      const ordered = isOrderedMarker(lines[index].trimStart());
      const start = index;
      while (index < lines.length && (lines[index].trim().length === 0 || isListMarker(lines[index].trimStart()))) index += 1;
      blocks.push(renderListBlock(lines.slice(start, index).map((line) => line.trimStart()), ordered));
      continue;
    }
    const start = index;
    while (index < lines.length && lines[index].trim().length !== 0) index += 1;
    blocks.push(`<p>${parseInline(lines.slice(start, index).join("\n"))}</p>`);
  }
  return blocks.length === 0 ? "" : `${blocks.join("\n")}\n`;
}

/** Substitute monster tokens, convert Markdown, and return sanitized HTML. */
export function markdownToHtml(markdown: string, monster: Monster): string {
  assertBrowserDom();
  return DOMPurify.sanitize(renderMarkdownSource(substitute(markdown, monster)));
}

/** Alias used by preview consumers. Both paths return sanitized HTML. */
export const renderMarkdown = markdownToHtml;
