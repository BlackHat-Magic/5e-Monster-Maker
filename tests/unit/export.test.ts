import { describe, expect, it, vi } from "vitest";
import { normalizeMonster } from "../../src/lib/monster/defaults";
import {
  EXPORT_FORMATS,
  exportContentBlob,
  exportFilename,
  hasCanvasEncoder,
  serializeStandaloneHtml,
  serializeStandaloneSvg,
} from "../../src/lib/monster/export";
import { statBlockThemeStyle } from "../../src/lib/theme/stat-block-themes";

const statBlock = {
  markup: '<article class="stat-block">Ash</article>',
  css: ".stat-block { color: red; }",
  width: 320,
  height: 180,
  theme: "monster-manual-smooth" as const,
};

describe("monster exports", () => {
  it("lists TOML and all visual formats in stable order", () => {
    expect(EXPORT_FORMATS.map((format) => format.key)).toEqual([
      "toml",
      "png",
      "webp",
      "avif",
      "svg",
      "html",
    ]);
  });

  it("uses the monster name and selected extension", () => {
    const monster = normalizeMonster({ name: "Ash & Ember" });

    expect(exportFilename(monster, "toml")).toBe("ash-ember.toml");
    expect(exportFilename(monster, "png")).toBe("ash-ember.png");
    expect(exportFilename(monster, "html")).toBe("ash-ember.html");
  });

  it("detects requested canvas MIME support and rejects fallback MIME output", () => {
    const canvas = {
      toDataURL: (mime: string) => `data:${mime};base64,encoded`,
    } as HTMLCanvasElement;
    const fallbackCanvas = {
      toDataURL: () => "data:image/png;base64,encoded",
    } as HTMLCanvasElement;

    expect(hasCanvasEncoder("image/webp", canvas)).toBe(true);
    expect(hasCanvasEncoder("image/avif", fallbackCanvas)).toBe(false);
  });

  it("decodes base64 and URL-encoded data URLs into binary export Blobs", async () => {
    const base64 = exportContentBlob("data:image/png;base64,AAH/", "image/png");
    const encoded = exportContentBlob("data:image/png,%00%01%FF", "image/png");

    expect(base64.type).toBe("image/png");
    expect([...new Uint8Array(await base64.arrayBuffer())]).toEqual([0, 1, 255]);
    expect([...new Uint8Array(await encoded.arrayBuffer())]).toEqual([0, 1, 255]);
  });

  it("serializes the stat-block font fallback variables exactly", () => {
    const copyFontStack = '"Noto Sans", "Myriad Pro", Calibri, Helvetica, Arial, sans-serif';
    const displayFontStack = '"Libre Baskerville", "Lora", "Calisto MT", "Bookman Old Style", Bookman, Georgia, serif';
    const style = statBlockThemeStyle("monster-manual-smooth");

    expect(style).toContain(`--font-copy: ${copyFontStack};`);
    expect(style).toContain(`--font-display: ${displayFontStack};`);
  });

  it("returns false when canvas detection has no document or canvas", () => {
    vi.stubGlobal("document", undefined);
    try {
      expect(hasCanvasEncoder("image/webp")).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("embeds stat-block markup, CSS, and texture data in HTML", () => {
    const html = serializeStandaloneHtml({
      title: "Ash & Ember",
      ...statBlock,
      theme: "monster-manual-textured",
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("<style>");
    expect(html).toContain(".stat-block { color: red; }");
    expect(html).toContain("Ash");
    expect(html).toContain("data:image/svg+xml");
    expect(html).not.toContain("document.documentElement");
    expect(html).not.toMatch(/(?:https?:)?\/\//);

    const parsed = new DOMParser().parseFromString(html, "text/html");
    const boundary = parsed.querySelector(".standalone-stat-block");
    const root = parsed.querySelector(".stat-block");
    expect(parsed.body.getAttribute("style")).toBe("margin: 0;");
    expect(boundary?.getAttribute("style")).toContain("width: 320px;");
    expect(boundary?.getAttribute("style")).toContain("height: 180px;");
    expect(root?.getAttribute("class")).toContain("stat-block");
    expect(root?.getAttribute("style")).toContain("--bg: #FDF1DC;");
    expect(html).toContain("*, *::before, *::after { box-sizing: border-box; border: 0 solid; border-radius: 0 !important; margin: 0; padding: 0; }");
    expect(html).toContain("body { margin: 0; padding: 0; }");
    expect(html).toContain(".stat-block { line-height: 1.5; }");
    expect(html).toContain("h1, h2, h3, h4, h5, h6 { margin: 0; font-size: inherit; font-weight: inherit; }");
    expect(html).toContain("p, blockquote, dl, dd, figure, hr { margin: 0; }");
    expect(html).toContain("ul, ol, menu { margin: 0; padding: 0; list-style: none; }");
    expect(html).toContain("img, svg, video, canvas, audio, iframe, embed, object { display: block; vertical-align: middle; }");
  });

  it("keeps standalone HTML and SVG styles free of external font references", () => {
    const html = serializeStandaloneHtml({ title: "Offline", ...statBlock });
    const svg = serializeStandaloneSvg({ title: "Offline", ...statBlock });
    const htmlStyle = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
    const svgStyle = svg.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
    const externalReference = /fonts\.googleapis\.com|fonts\.gstatic\.com|https?:\/\//i;

    expect(htmlStyle).toContain("--font-copy: \"Noto Serif\"");
    expect(htmlStyle).toContain("--font-display: \"Noto Serif\"");
    expect(htmlStyle).not.toMatch(externalReference);
    expect(svgStyle).not.toMatch(externalReference);
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("fonts.gstatic.com");
    expect(html).not.toMatch(/https?:\/\//i);
  });

  it("creates an SVG with exact cropped dimensions and embedded CSS", () => {
    const svg = serializeStandaloneSvg({
      title: "Ash & Ember",
      ...statBlock,
      markup: '<article class="stat-block" data-preserved="yes">Ash</article>',
    });

    expect(svg).toContain('width="320"');
    expect(svg).toContain('height="180"');
    expect(svg).toContain('viewBox="0 0 320 180"');
    expect(svg).toContain("foreignObject");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('xmlns="http://www.w3.org/1999/xhtml"');
    expect(svg).toContain(".stat-block { color: red; }");
    expect(svg).toContain("--font-copy:");
    expect(svg).toContain("--font-display:");
    expect(svg).toContain("--bg: #FDF1DC;");
    expect(svg).toContain('data-preserved="yes"');
    expect(new DOMParser().parseFromString(svg, "image/svg+xml").querySelector(".stat-block")?.getAttribute("style")).toContain(
      "--bg: #FDF1DC;",
    );
    expect(new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("parsererror")).toBeNull();
  });

  it("preserves explicit two-panel layout rules in standalone HTML and SVG CSS", () => {
    const block = {
      title: "Two Column",
      ...statBlock,
      markup: '<article class="stat-block stat-block--two-column"><div class="stat-block__panels"><div class="stat-block__panel stat-block__panel--left">Left</div><div class="stat-block__panel stat-block__panel--right">Right</div></div></article>',
    };
    const expectedRules = [
      ".standalone-stat-block .stat-block.stat-block--two-column { width: min(100%, 800px); }",
      ".standalone-stat-block .stat-block--two-column .stat-block__panels { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }",
    ];

    for (const output of [serializeStandaloneHtml(block), serializeStandaloneSvg(block)]) {
      for (const rule of expectedRules) expect(output).toContain(rule);
      expect(output).not.toContain("column-count");
    }
  });

  it("makes standalone HTML responsive while keeping standalone SVG fixed-size", () => {
    const block = {
      title: "Responsive Two Column",
      ...statBlock,
      markup: '<article class="stat-block stat-block--two-column"><div class="stat-block__panels"><div class="stat-block__panel stat-block__panel--left">Left</div><div class="stat-block__panel stat-block__panel--right">Right</div></div></article>',
    };
    const html = serializeStandaloneHtml(block);
    const svg = serializeStandaloneSvg(block);
    const responsiveRules = [
      ".standalone-stat-block { width: 100% !important; height: auto !important; overflow: visible !important; }",
      ".standalone-stat-block .stat-block--two-column .stat-block__panels { grid-template-columns: minmax(0, 1fr); gap: 0; }",
    ];

    for (const rule of responsiveRules) expect(html).toContain(rule);
    expect(svg).not.toContain("width: 100% !important");
    expect(svg).not.toContain("height: auto !important");
    expect(svg).not.toContain("overflow: visible !important");
    expect(svg.lastIndexOf("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)")).toBeGreaterThan(
      svg.indexOf("grid-template-columns: minmax(0, 1fr);"),
    );
  });

  it("escapes HTML and XML metadata", () => {
    const title = `Ash & <Ember> "Prime" 's`;
    const html = serializeStandaloneHtml({ title, ...statBlock });
    const svg = serializeStandaloneSvg({ title, ...statBlock });

    expect(html).toContain("<title>Ash &amp; &lt;Ember&gt; &quot;Prime&quot; &#39;s</title>");
    expect(svg).toContain("<title>Ash &amp; &lt;Ember&gt; &quot;Prime&quot; &apos;s</title>");
    expect(svg).not.toContain("<Ember>");
  });

  it("self-closes HTML void elements in SVG output", () => {
    const voidElements = [
      "area",
      "base",
      "br",
      "col",
      "embed",
      "hr",
      "img",
      "input",
      "link",
      "meta",
      "param",
      "source",
      "track",
      "wbr",
    ];
    const svg = serializeStandaloneSvg({
      ...statBlock,
      markup: `<article class="stat-block">Before${voidElements.map((tag) => `<${tag} data-tag="${tag}">`).join("")}After</article>`,
      title: "Ash",
    });
    const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");

    expect(parsed.querySelector("parsererror")).toBeNull();
    for (const tag of voidElements) {
      expect(svg).toContain(`<${tag} data-tag="${tag}" />`);
      expect(parsed.querySelector(tag)?.getAttribute("data-tag")).toBe(tag);
    }
    expect(parsed.querySelector("article")?.textContent).toContain("BeforeAfter");
  });

  it("decodes named HTML entities before producing XML", () => {
    const svg = serializeStandaloneSvg({
      ...statBlock,
      markup: '<article class="stat-block" data-label="Ash&nbsp;&copy;">Ash&nbsp;&copy;</article>',
      title: "Ash",
    });
    const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
    const article = parsed.querySelector("article");

    expect(parsed.querySelector("parsererror")).toBeNull();
    expect(article?.getAttribute("data-label")).toBe("Ash\u00a0©");
    expect(article?.textContent).toBe("Ash\u00a0©");
    expect(svg).not.toContain("&nbsp;");
    expect(svg).not.toContain("&copy;");
  });

  it("uses a no-DOM fallback for common and numeric HTML entities", () => {
    vi.stubGlobal("document", undefined);
    try {
      const svg = serializeStandaloneSvg({
        ...statBlock,
        markup: '<article class="stat-block" data-label="&nbsp;&copy;&trade;&reg;&hellip;&ndash;&mdash;&rsquo;&lsquo;&rdquo;&ldquo;&bull;&middot;&amp;&lt;&gt;&quot;&apos;&#160;&#xA9;&#x110000;&#0;">&nbsp;&copy;&trade;&reg;&hellip;&ndash;&mdash;&rsquo;&lsquo;&rdquo;&ldquo;&bull;&middot;&amp;&lt;&gt;&quot;&apos;&#160;&#xA9;&#x110000;&#0;</article>',
        title: "Ash",
      });
      const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
      const article = parsed.querySelector("article");

      expect(parsed.querySelector("parsererror")).toBeNull();
      expect(article?.getAttribute("data-label")).toBe("\u00a0©™®…–—’‘”“•·&<>\"'\u00a0©&#x110000;&#0;");
      expect(article?.textContent).toBe("\u00a0©™®…–—’‘”“•·&<>\"'\u00a0©&#x110000;&#0;");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("requires positive integer dimensions", () => {
    for (const dimensions of [
      { width: 0, height: 180 },
      { width: 320, height: 0 },
      { width: -1, height: 180 },
      { width: 320, height: 1.5 },
      { width: Number.NaN, height: 180 },
    ]) {
      expect(() => serializeStandaloneHtml({ title: "Ash", ...statBlock, ...dimensions })).toThrow(
        "Export dimensions must be positive integers",
      );
      expect(() => serializeStandaloneSvg({ title: "Ash", ...statBlock, ...dimensions })).toThrow(
        "Export dimensions must be positive integers",
      );
    }
  });

  it("only embeds texture data for the textured theme", () => {
    const smooth = serializeStandaloneHtml({ title: "Ash", ...statBlock });
    const textured = serializeStandaloneHtml({
      title: "Ash",
      ...statBlock,
      theme: "monster-manual-textured",
    });

    expect(smooth).not.toContain("data:image/svg+xml");
    expect(textured).toContain("data:image/svg+xml");
    expect(textured).toContain("data:image/svg+xml,%3Csvg");
    expect(textured).not.toContain("data%3Aimage%2Fsvg%2Bxml");
  });

  it("preserves renderer-embedded texture assets in standalone exports", () => {
    const embeddedStyle = 'background-image: url("data:image/jpeg;base64,cGFyY2htZW50"), url("data:image/svg+xml;base64,ZmFsbGJhY2s=");';
    const block = {
      title: "Ash",
      ...statBlock,
      theme: "monster-manual-textured" as const,
      style: embeddedStyle,
    };

    for (const output of [serializeStandaloneHtml(block), serializeStandaloneSvg(block)]) {
      expect(output).toContain("data:image/jpeg;base64,cGFyY2htZW50");
      expect(output).toContain("data:image/svg+xml;base64,ZmFsbGJhY2s=");
      expect(output).not.toContain("/statblockparch.jpg");
      expect(output).not.toContain("/statblockbar.jpg");
    }
  });
});
