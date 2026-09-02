import { filenameForMonster } from "./toml";
import {
  statBlockThemeByKey,
  statBlockThemeStyle,
  type StatBlockThemeKey,
} from "../theme/stat-block-themes";
import type { Monster } from "./types";

export type ExportFormatKey = "toml" | "png" | "webp" | "avif" | "svg" | "html";
export type RasterExportFormat = "png" | "webp" | "avif";

export interface ExportFormat {
  key: ExportFormatKey;
  label: string;
  mime: string;
  extension: string;
  raster: boolean;
}

export interface SerializedStatBlock {
  markup: string;
  css: string;
  width: number;
  height: number;
  theme: StatBlockThemeKey;
}

type StandaloneStatBlock = SerializedStatBlock & { title: string };

export const EXPORT_FORMATS: readonly ExportFormat[] = [
  { key: "toml", label: "TOML", mime: "application/toml", extension: "toml", raster: false },
  { key: "png", label: "PNG", mime: "image/png", extension: "png", raster: true },
  { key: "webp", label: "WebP", mime: "image/webp", extension: "webp", raster: true },
  { key: "avif", label: "AVIF", mime: "image/avif", extension: "avif", raster: true },
  { key: "svg", label: "SVG", mime: "image/svg+xml", extension: "svg", raster: false },
  { key: "html", label: "HTML", mime: "text/html", extension: "html", raster: false },
];

const htmlEscapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const xmlEscapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => htmlEscapes[character]);
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => xmlEscapes[character]);
}

function assertDimensions({ width, height }: SerializedStatBlock): void {
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    throw new Error("Export dimensions must be positive integers");
  }
}

function standaloneStyle(block: SerializedStatBlock): string {
  return statBlockThemeStyle(block.theme);
}

type StandaloneCssMode = "html" | "svg";

function standaloneCss(block: SerializedStatBlock, mode: StandaloneCssMode): string {
  const textureRule = statBlockThemeByKey[block.theme].texture
    ? ".standalone-stat-block .stat-block { background-image: inherit; }"
    : "";
  const standaloneLayout = `.standalone-stat-block .stat-block.stat-block--two-column { width: min(100%, 800px); }
.standalone-stat-block .stat-block--two-column .stat-block__panels { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }`;
  const standaloneHtmlResponsive = `@media (max-width: 720px) {
.standalone-stat-block { width: 100% !important; height: auto !important; overflow: visible !important; }
.standalone-stat-block .stat-block.stat-block--two-column { width: min(100%, 400px); }
.standalone-stat-block .stat-block--two-column .stat-block__panels { grid-template-columns: minmax(0, 1fr); gap: 0; }
}`;
  const standaloneReset = `*, *::before, *::after { box-sizing: border-box; border: 0 solid; border-radius: 0 !important; margin: 0; padding: 0; }
body { margin: 0; padding: 0; }
.stat-block { line-height: 1.5; }
h1, h2, h3, h4, h5, h6 { margin: 0; font-size: inherit; font-weight: inherit; }
p, blockquote, dl, dd, figure, hr { margin: 0; }
ul, ol, menu { margin: 0; padding: 0; list-style: none; }
img, svg, video, canvas, audio, iframe, embed, object { display: block; vertical-align: middle; }
img, video { max-width: 100%; height: auto; }
button, input, select, textarea, optgroup { font: inherit; }
button, input, select, textarea { color: inherit; }`;
  const standaloneFontFallback = ':root { --font-copy: "Noto Serif", "Merriweather", Georgia, "Times New Roman", serif; --font-display: "Noto Serif", "Merriweather", Georgia, "Times New Roman", serif; }';
  return `${standaloneReset}\n${standaloneFontFallback}\n${block.css}\n${standaloneLayout}\n${mode === "html" ? standaloneHtmlResponsive : ""}\n${textureRule}`;
}

function tagEnd(markup: string, start: number): number {
  let quote: string | undefined;
  for (let index = start + 1; index < markup.length; index += 1) {
    const character = markup[index];
    if (quote) {
      if (character === quote) quote = undefined;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }
  return -1;
}

function injectStatBlockThemeStyle(
  markup: string,
  style: string,
  escapeAttribute: (value: string) => string,
): string {
  let cursor = 0;
  while (cursor < markup.length) {
    const start = markup.indexOf("<", cursor);
    if (start === -1) return markup;
    if (markup.startsWith("<!--", start)) {
      const commentEnd = markup.indexOf("-->", start + 4);
      if (commentEnd === -1) return markup;
      cursor = commentEnd + 3;
      continue;
    }

    const end = tagEnd(markup, start);
    if (end === -1) return markup;
    const tag = markup.slice(start, end + 1);
    const classAttribute = /\bclass\s*=\s*(["'])(.*?)\1/i.exec(tag);
    if (classAttribute?.[2].split(/\s+/).includes("stat-block")) {
      const encodedStyle = escapeAttribute(style);
      const styleAttribute = /(\sstyle\s*=\s*)(["'])([\s\S]*?)\2/i;
      const hasStyleAttribute = styleAttribute.test(tag);
      const themedTag = tag.replace(
        styleAttribute,
        (_match, prefix: string, quote: string, current: string) =>
          `${prefix}${quote}${current.trim()}${current.trim() ? "; " : ""}${encodedStyle}${quote}`,
      );
      return `${markup.slice(0, start)}${hasStyleAttribute ? themedTag : `${tag.slice(0, -1)} style="${encodedStyle}">`}${markup.slice(end + 1)}`;
    }
    cursor = end + 1;
  }
  return markup;
}

const svgVoidElement = /<\s*(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i;
const svgVoidClosingElement = /<\s*\/\s*(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\s*>/i;
const fallbackHtmlEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  bull: "\u2022",
  nbsp: "\u00a0",
  copy: "\u00a9",
  divide: "\u00f7",
  gt: ">",
  hellip: "\u2026",
  ldquo: "\u201c",
  lsquo: "\u2018",
  lt: "<",
  mdash: "\u2014",
  middot: "\u00b7",
  ndash: "\u2013",
  quot: '"',
  rdquo: "\u201d",
  reg: "\u00ae",
  rsquo: "\u2019",
  trade: "\u2122",
};

function isValidXmlCodePoint(codePoint: number): boolean {
  return (
    codePoint === 0x9 ||
    codePoint === 0xa ||
    codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  );
}

function decodeHtmlEntities(value: string): string {
  if (!value.includes("&")) return value;
  if (typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = value;
      return textarea.value;
    } catch {
      // Fall through to the entity subset needed without a browser DOM.
    }
  }

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/gi, (entity, name: string) => {
    if (name[0] === "#") {
      const codePoint = name[1].toLowerCase() === "x" ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      return isValidXmlCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return fallbackHtmlEntities[name.toLowerCase()] ?? entity;
  });
}

function normalizeSvgTag(tag: string): string {
  return tag.replace(/(=\s*)(["'])([\s\S]*?)\2/g, (_match, prefix: string, quote: string, value: string) =>
    `${prefix}${quote}${escapeXml(decodeHtmlEntities(value))}${quote}`,
  );
}

function normalizeSvgMarkup(markup: string): string {
  let result = "";
  let cursor = 0;

  while (cursor < markup.length) {
    const start = markup.indexOf("<", cursor);
    if (start === -1) return result + escapeXml(decodeHtmlEntities(markup.slice(cursor)));
    result += escapeXml(decodeHtmlEntities(markup.slice(cursor, start)));

    if (markup.startsWith("<!--", start)) {
      const commentEnd = markup.indexOf("-->", start + 4);
      if (commentEnd === -1) return result + markup.slice(start);
      const end = commentEnd + 3;
      result += markup.slice(start, end);
      cursor = end;
      continue;
    }

    let quote: string | undefined;
    let end = start + 1;
    for (; end < markup.length; end += 1) {
      const character = markup[end];
      if (quote) {
        if (character === quote) quote = undefined;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        break;
      }
    }
    if (end === markup.length) return result + markup.slice(start);

    const tag = normalizeSvgTag(markup.slice(start, end + 1));
    if (svgVoidClosingElement.test(tag)) {
      cursor = end + 1;
      continue;
    }
    if (svgVoidElement.test(tag) && !/\/\s*>$/.test(tag)) {
      result += `${tag.slice(0, -1).replace(/\s+$/, "")} />`;
    } else {
      result += tag;
    }
    cursor = end + 1;
  }

  return result;
}

export function exportFilename(monster: Monster, format: ExportFormatKey): string {
  const filename = filenameForMonster(monster);
  return format === "toml" ? filename : filename.replace(/\.toml$/, `.${format}`);
}

export function hasCanvasEncoder(
  mime: string,
  canvas?: HTMLCanvasElement,
): boolean {
  let target = canvas;
  if (!target) {
    if (typeof document === "undefined") return false;
    try {
      target = document.createElement("canvas");
    } catch {
      return false;
    }
  }

  try {
    const dataUrl = target.toDataURL(mime);
    const returnedMime = /^data:([^;,]+)/i.exec(dataUrl)?.[1];
    return returnedMime?.toLowerCase() === mime.toLowerCase();
  } catch {
    return false;
  }
}

function dataUrlBytes(payload: string): Uint8Array {
  const bytes: number[] = [];
  for (let index = 0; index < payload.length;) {
    if (payload[index] === "%") {
      const encodedByte = payload.slice(index + 1, index + 3);
      if (!/^[\da-f]{2}$/i.test(encodedByte)) throw new Error("Invalid percent-encoded export data");
      bytes.push(Number.parseInt(encodedByte, 16));
      index += 3;
      continue;
    }

    const encodedCharacter = new TextEncoder().encode(payload[index]);
    bytes.push(...encodedCharacter);
    index += 1;
  }
  return Uint8Array.from(bytes);
}

export function exportContentBlob(content: string, mime: string): Blob {
  if (!content.toLowerCase().startsWith("data:")) return new Blob([content], { type: mime });

  const comma = content.indexOf(",");
  if (comma < 0) throw new Error("Invalid export data URL");
  const metadata = content.slice(5, comma);
  const payload = content.slice(comma + 1);
  const isBase64 = metadata.split(";").some((part) => part.toLowerCase() === "base64");

  if (isBase64) {
    const binary = atob(payload);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Blob([bytes.buffer as ArrayBuffer], { type: mime });
  }

  return new Blob([dataUrlBytes(payload).buffer as ArrayBuffer], { type: mime });
}

export function serializeStandaloneHtml(block: StandaloneStatBlock): string {
  assertDimensions(block);
  const style = standaloneStyle(block);
  const markup = injectStatBlockThemeStyle(block.markup, style, escapeHtml);
  const boundaryStyle = `width: ${block.width}px; height: ${block.height}px; margin: 0; overflow: hidden; ${style}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(block.title)}</title>
<style>${standaloneCss(block, "html")}</style>
</head>
<body style="margin: 0;">
<div class="standalone-stat-block" style="${escapeHtml(boundaryStyle)}">${markup}</div>
</body>
</html>`;
}

export function serializeStandaloneSvg(block: StandaloneStatBlock): string {
  assertDimensions(block);
  const style = standaloneStyle(block);
  const { width, height } = block;
  const markup = injectStatBlockThemeStyle(normalizeSvgMarkup(block.markup), style, escapeXml);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<title>${escapeXml(block.title)}</title>
<style>${escapeXml(standaloneCss(block, "svg"))}</style>
<foreignObject x="0" y="0" width="${width}" height="${height}">
<div xmlns="http://www.w3.org/1999/xhtml" class="standalone-stat-block" style="${escapeXml(style)}">${markup}</div>
</foreignObject>
</svg>`;
}
