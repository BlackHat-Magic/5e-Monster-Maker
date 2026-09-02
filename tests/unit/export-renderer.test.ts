// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeMonster } from "../../src/lib/monster/defaults";
import statBlockStyles from "../../src/lib/components/preview/stat-block.css?inline";
import {
  EXPORT_ASYNC_TIMEOUT_MS,
  renderVisualExport,
  UnsupportedEncoderError,
} from "../../src/lib/monster/export-renderer";

const originalImage = globalThis.Image;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
const originalCreateElement = document.createElement;
const originalFonts = document.fonts;

let drawImage: ReturnType<typeof vi.fn>;
let toDataURL: ReturnType<typeof vi.fn>;
let measuredArticle: HTMLElement | undefined;
let measuredArticleIds: string[];
let imageForFrame: HTMLImageElement | undefined;
let resourceNodesForFrame: Element[];
let rasterImageSource: string | undefined;
let rafCalls: number;

class LoadingImage {
  onload: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;

  set src(value: string) {
    rasterImageSource = value;
    this.onload?.();
  }
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.documentElement.dataset.theme = "catppuccin-mocha";
  measuredArticle = undefined;
  measuredArticleIds = [];
  imageForFrame = undefined;
  resourceNodesForFrame = [];
  rasterImageSource = undefined;
  rafCalls = 0;
  drawImage = vi.fn();
  toDataURL = vi.fn((mime: string) => `data:${mime};base64,encoded`);

  vi.stubGlobal("Image", LoadingImage);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    rafCalls += 1;
    if (imageForFrame) {
      document.querySelector("article.stat-block")?.append(imageForFrame);
      imageForFrame = undefined;
    }
    if (resourceNodesForFrame.length > 0) {
      document.querySelector("article.stat-block")?.append(...resourceNodesForFrame);
      resourceNodesForFrame = [];
    }
    callback(0);
    return rafCalls;
  });
  vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
    const element = originalCreateElement.call(document, tagName, options);
    if (tagName.toLowerCase() === "canvas") {
      Object.defineProperty(element, "getContext", { configurable: true, value: () => ({ drawImage }) });
      Object.defineProperty(element, "toDataURL", { configurable: true, value: toDataURL });
    }
    return element;
  }) as typeof document.createElement);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (!this.matches("article.stat-block")) return originalGetBoundingClientRect.call(this);
    measuredArticle = this;
    measuredArticleIds.push(this.getAttribute("aria-labelledby") ?? "");
    expect(this.parentElement?.style.position).toBe("fixed");
    expect(this.parentElement?.style.width).toBe("418px");
    return { width: 417.2, height: 231.1 } as DOMRect;
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(document, "fonts", { configurable: true, value: originalFonts });
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  globalThis.Image = originalImage;
  globalThis.requestAnimationFrame = originalRequestAnimationFrame;
});

describe("browser visual exports", () => {
  it("loads the shared stylesheet through the inline CSS import", () => {
    expect(typeof statBlockStyles).toBe("string");
    expect(statBlockStyles).toContain(".stat-block");
  });

	it("measures the rendered stat block without surrounding canvas", async () => {
    const result = await renderVisualExport({
      monster: normalizeMonster({ name: "Boundary Test" }),
      theme: "monster-manual-smooth",
      format: "svg",
      previewWidth: 418,
    });

    expect(result.width).toBe(418);
    expect(result.height).toBe(232);
    expect(result.content).toContain('viewBox="0 0 418 232"');
    expect(result.content).not.toMatch(/<canvas\b/);
    expect(rafCalls).toBe(1);
		expect(measuredArticle).toBeDefined();
	});

	it("serializes a two-column export only after layout measurement is ready", async () => {
		const result = await renderVisualExport({
			monster: normalizeMonster({ name: "Measured Export", two_column: true }),
			theme: "monster-manual-smooth",
			format: "html",
			previewWidth: 418,
		});

		expect(result.content).toContain('data-stat-block-layout="measured"');
	});

  it("waits for mounted images to finish loading before measuring", async () => {
    const image = document.createElement("img");
    image.setAttribute("src", "data:image/png;base64,AA==");
    Object.defineProperty(image, "complete", { configurable: true, value: false });
    imageForFrame = image;

    const exportPromise = renderVisualExport({
      monster: normalizeMonster({ name: "Delayed Image" }),
      theme: "monster-manual-smooth",
      format: "svg",
      previewWidth: 418,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(measuredArticle).toBeUndefined();

    await new Promise<void>((resolve) => setTimeout(() => {
      image.dispatchEvent(new Event("load"));
      resolve();
    }, 0));
    const result = await exportPromise;

    expect(result.height).toBe(232);
    expect(measuredArticle).toBeDefined();
  });

  it("reports failed mounted images and removes the offscreen container", async () => {
    const image = document.createElement("img");
    image.setAttribute("src", "data:image/png;base64,AA==");
    Object.defineProperty(image, "complete", { configurable: true, value: false });
    imageForFrame = image;

    const exportPromise = renderVisualExport({
      monster: normalizeMonster({ name: "Broken Image" }),
      theme: "monster-manual-smooth",
      format: "svg",
      previewWidth: 418,
    });
    await Promise.resolve();
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(() => {
      image.dispatchEvent(new Event("error"));
      resolve();
    }, 0));

    await expect(exportPromise).rejects.toThrow("Failed to load stat block image");
    expect(document.body.children).toHaveLength(0);
  });

  it("embeds fetched images and removes network-dependent srcset before serializing", async () => {
    const image = document.createElement("img");
    image.setAttribute("src", "/portrait.png");
    image.setAttribute("srcset", "/portrait.png 1x, /portrait@2x.png 2x");
    Object.defineProperty(image, "complete", { configurable: true, value: false });
    imageForFrame = image;
    const fetchImage = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
    }));
    vi.stubGlobal("fetch", fetchImage);

    const exportPromise = renderVisualExport({
      monster: normalizeMonster({ name: "Embedded Image" }),
      theme: "monster-manual-smooth",
      format: "svg",
      previewWidth: 418,
    });
    await vi.waitFor(() => expect(image.getAttribute("src")).toMatch(/^data:image\/png;base64,/));
    await new Promise<void>((resolve) => setTimeout(() => {
      image.dispatchEvent(new Event("load"));
      resolve();
    }, 0));
    const result = await exportPromise;

    expect(fetchImage).toHaveBeenCalledWith("http://localhost/portrait.png", expect.any(Object));
    expect(result.content).toContain("data:image/png;base64");
    expect(result.content).not.toContain("portrait.png");
    expect(result.content).not.toContain("srcset=");
  });

  it("reports a clear error and cleans up when an image cannot be embedded", async () => {
    const image = document.createElement("img");
    image.setAttribute("src", "/missing.png");
    imageForFrame = image;
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network unavailable");
    }));

    await expect(renderVisualExport({
      monster: normalizeMonster({ name: "Missing Image" }),
      theme: "monster-manual-smooth",
      format: "html",
      previewWidth: 418,
    })).rejects.toThrow("Unable to embed resource");
    expect(document.body.children).toHaveLength(0);
  });

  it("embeds SVG image and inline style resources without rewriting anchor links", async () => {
    const svgImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
    svgImage.setAttribute("href", "/portrait.svg");
    svgImage.setAttribute("xlink:href", "/portrait.svg");
    const styled = document.createElement("div");
    styled.setAttribute("style", "background-image: url('/background.png')");
    const link = document.createElement("a");
    link.setAttribute("href", "/rules/conditions");
    link.textContent = "Rules";
    resourceNodesForFrame = [svgImage, styled, link];
    const fetchResource = vi.fn(async (url: string) => ({
      ok: true,
      blob: async () => new Blob([url], { type: "image/png" }),
    }));
    vi.stubGlobal("fetch", fetchResource);

    const result = await renderVisualExport({
      monster: normalizeMonster({ name: "Embedded Resources" }),
      theme: "monster-manual-smooth",
      format: "html",
      previewWidth: 418,
    });

    expect(fetchResource).toHaveBeenCalledWith("http://localhost/portrait.svg", expect.any(Object));
    expect(fetchResource).toHaveBeenCalledWith("http://localhost/background.png", expect.any(Object));
    expect(result.content).not.toContain("portrait.svg");
    expect(result.content).not.toContain("background.png");
    expect(result.content).toContain("data:image/png;base64");
    expect(result.content).toContain('href="/rules/conditions"');
  });

  it("rejects external CSS imports instead of leaving them network-dependent", async () => {
    const style = document.createElement("style");
    style.textContent = '@import url("/fonts.css");';
    resourceNodesForFrame = [style];
    const fetchResource = vi.fn();
    vi.stubGlobal("fetch", fetchResource);

    await expect(renderVisualExport({
      monster: normalizeMonster({ name: "External CSS" }),
      theme: "monster-manual-smooth",
      format: "html",
      previewWidth: 418,
    })).rejects.toThrow("external CSS imports are not supported");
    expect(fetchResource).not.toHaveBeenCalled();
    expect(document.body.children).toHaveLength(0);
  });

  it("propagates cancellation into a pending resource fetch", async () => {
    const image = document.createElement("img");
    image.setAttribute("src", "/pending.png");
    resourceNodesForFrame = [image];
    let fetchSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      fetchSignal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        fetchSignal?.addEventListener("abort", () => reject(new Error("request aborted")), { once: true });
      });
    }));
    const controller = new AbortController();
    const exportPromise = renderVisualExport({
      monster: normalizeMonster({ name: "Cancelled Resource" }),
      theme: "monster-manual-smooth",
      format: "html",
      previewWidth: 418,
      signal: controller.signal,
    });

    await vi.waitFor(() => expect(fetchSignal).toBeDefined());
    controller.abort();

    await expect(exportPromise).rejects.toMatchObject({ name: "AbortError", message: "Export cancelled" });
    expect(fetchSignal?.aborted).toBe(true);
    expect(document.body.children).toHaveLength(0);
  });

  it("waits for document fonts before measuring", async () => {
    let resolveFonts!: () => void;
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: new Promise<void>((resolve) => (resolveFonts = resolve)) },
    });

    const exportPromise = renderVisualExport({
      monster: normalizeMonster({ name: "Font Test" }),
      theme: "monster-manual-smooth",
      format: "svg",
      previewWidth: 418,
    });
    await Promise.resolve();
    expect(measuredArticle).toBeUndefined();
    resolveFonts();
    await exportPromise;
    expect(measuredArticle).toBeDefined();
  });

  it("times out a mounted image that never settles and cleans up", async () => {
    vi.useFakeTimers();
    const image = document.createElement("img");
    image.setAttribute("src", "data:image/png;base64,AA==");
    Object.defineProperty(image, "complete", { configurable: true, value: false });
    imageForFrame = image;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      document.querySelector("article.stat-block")?.append(image);
      callback(0);
      return 1;
    });

    const exportPromise = renderVisualExport({
      monster: normalizeMonster({ name: "Stalled Image" }),
      theme: "monster-manual-smooth",
      format: "svg",
      previewWidth: 418,
    });
    await Promise.resolve();
    const rejection = expect(exportPromise).rejects.toThrow("Timed out waiting for stat block images");
    await vi.advanceTimersByTimeAsync(EXPORT_ASYNC_TIMEOUT_MS);

    await rejection;
    expect(document.body.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out a missing animation frame and cleans up", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));

    const exportPromise = renderVisualExport({
      monster: normalizeMonster({ name: "Stalled Frame" }),
      theme: "monster-manual-smooth",
      format: "svg",
      previewWidth: 418,
    });
    const rejection = expect(exportPromise).rejects.toThrow("Timed out waiting for stat block render");
    await vi.advanceTimersByTimeAsync(EXPORT_ASYNC_TIMEOUT_MS);

    await rejection;
    expect(document.body.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts a pending animation frame and cleans up", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    const controller = new AbortController();

    const exportPromise = renderVisualExport({
      monster: normalizeMonster({ name: "Cancelled Frame" }),
      theme: "monster-manual-smooth",
      format: "svg",
      previewWidth: 418,
      signal: controller.signal,
    });
    await Promise.resolve();
    controller.abort();

    await expect(exportPromise).rejects.toMatchObject({ name: "AbortError", message: "Export cancelled" });
    expect(document.body.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("requests the selected raster MIME type", async () => {
    const result = await renderVisualExport({
      monster: normalizeMonster({ name: "WebP Test" }),
      theme: "catppuccin-latte",
      format: "webp",
      previewWidth: 418,
    });

    expect(result.mime).toBe("image/webp");
    expect(toDataURL).toHaveBeenCalledWith("image/webp");
    expect(drawImage).toHaveBeenCalledOnce();
    expect(rasterImageSource).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it("serializes standalone HTML with the selected theme", async () => {
    const result = await renderVisualExport({
      monster: normalizeMonster({ name: "HTML Test" }),
      theme: "monster-manual-smooth",
      format: "html",
      previewWidth: 418,
    });

    expect(result.mime).toBe("text/html");
    expect(result.content).toContain("<!doctype html>");
    expect(result.content).toContain("HTML Test");
		expect(result.content).toContain("--bg: #FDF1DC;");
    expect(result.content).not.toContain("catppuccin-mocha");
  });

  it("gives each export a unique ID prefix and cleans up its container", async () => {
    const sentinel = document.createElement("div");
    document.body.append(sentinel);

    await renderVisualExport({
      monster: normalizeMonster({ name: "First" }),
      theme: "monster-manual-smooth",
      format: "svg",
      previewWidth: 418,
    });
    await renderVisualExport({
      monster: normalizeMonster({ name: "Second" }),
      theme: "monster-manual-smooth",
      format: "svg",
      previewWidth: 418,
    });

    expect(measuredArticleIds).toHaveLength(2);
    expect(measuredArticleIds[0]).not.toBe(measuredArticleIds[1]);
    expect(document.body.children).toHaveLength(1);
    expect(document.body.firstElementChild).toBe(sentinel);
  });

  it("cleans up the offscreen container when the SVG image cannot load", async () => {
    vi.stubGlobal("Image", class FailingImage {
      onload: (() => void) | null = null;
      onerror: ((error: Error) => void) | null = null;

      set src(_value: string) {
        this.onerror?.(new Error("image failed"));
      }
    });

    await expect(renderVisualExport({
      monster: normalizeMonster({ name: "Image Failure" }),
      theme: "monster-manual-smooth",
      format: "png",
      previewWidth: 418,
    })).rejects.toThrow("image failed");
    expect(document.body.children).toHaveLength(0);
  });

  it("times out SVG image loading and clears image handlers and timers", async () => {
    vi.useFakeTimers();
    let image: { onload: (() => void) | null; onerror: ((error: Error) => void) | null } | undefined;
    vi.stubGlobal("Image", class BlockingImage {
      onload: (() => void) | null = null;
      onerror: ((error: Error) => void) | null = null;

      constructor() {
        image = this;
      }
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    const exportPromise = renderVisualExport({
      monster: normalizeMonster({ name: "Stalled SVG Image" }),
      theme: "monster-manual-smooth",
      format: "png",
      previewWidth: 418,
    });
    await Promise.resolve();
    const rejection = expect(exportPromise).rejects.toThrow("Timed out loading SVG export image");
    await vi.advanceTimersByTimeAsync(EXPORT_ASYNC_TIMEOUT_MS);

    await rejection;
    expect(image?.onload).toBeNull();
    expect(image?.onerror).toBeNull();
    expect(document.body.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects clearly when browser APIs are unavailable", async () => {
    vi.stubGlobal("window", undefined);

    await expect(renderVisualExport({
      monster: normalizeMonster({ name: "No Browser" }),
      theme: "monster-manual-smooth",
      format: "svg",
      previewWidth: 418,
    })).rejects.toThrow("renderVisualExport requires a browser environment");
  });

  it("throws a typed error when a canvas returns a fallback MIME", async () => {
    toDataURL.mockReturnValue("data:image/png;base64,encoded");

    await expect(renderVisualExport({
      monster: normalizeMonster({ name: "Unsupported AVIF" }),
      theme: "monster-manual-smooth",
      format: "avif",
      previewWidth: 418,
    })).rejects.toBeInstanceOf(UnsupportedEncoderError);
  });
});
