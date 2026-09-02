import { flushSync, mount, unmount } from "svelte";
import statBlockStyles from "$lib/components/preview/stat-block.css?inline";
import StatBlock from "$lib/components/preview/StatBlock.svelte";
import { createPreviewModel } from "$lib/monster/preview";
import {
	EXPORT_FORMATS,
	serializeStandaloneHtml,
	serializeStandaloneSvg,
} from "$lib/monster/export";
import type { Monster } from "$lib/monster/types";
import type { StatBlockThemeKey } from "$lib/theme/stat-block-themes";

export interface RenderVisualExportOptions {
	monster: Monster;
	theme: StatBlockThemeKey;
	format: "png" | "webp" | "avif" | "svg" | "html";
	previewWidth: number;
	signal?: AbortSignal;
}

export interface RenderedVisualExport {
	content: string;
	mime: string;
	width: number;
	height: number;
}

export const EXPORT_ASYNC_TIMEOUT_MS = 5000;

export class UnsupportedEncoderError extends Error {
	readonly mime: string;

	constructor(mime: string) {
		super(`Canvas encoder did not return the requested MIME type: ${mime}`);
		this.name = "UnsupportedEncoderError";
		this.mime = mime;
	}
}

let exportSequence = 0;

function nextExportIdPrefix(): string {
	exportSequence += 1;
	return `export-preview-${exportSequence}`;
}

function assertBrowserEnvironment(): void {
	if (
		typeof window === "undefined" ||
		typeof document === "undefined" ||
		!document.body ||
		typeof document.createElement !== "function" ||
		typeof requestAnimationFrame !== "function" ||
		typeof setTimeout !== "function" ||
		typeof clearTimeout !== "function" ||
		typeof Image === "undefined" ||
		typeof Blob === "undefined"
	) {
		throw new Error("renderVisualExport requires a browser environment with DOM, image, and canvas APIs");
	}
}

function abortError(): Error {
	const error = new Error("Export cancelled");
	error.name = "AbortError";
	return error;
}

function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw abortError();
}

function waitForAnimationFrame(signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		let frameId: number | undefined;
		let settled = false;
		let timeoutId: ReturnType<typeof setTimeout>;
		const onAbort = () => finish(abortError());
		const cleanup = () => {
			clearTimeout(timeoutId);
			if (frameId !== undefined && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frameId);
			signal?.removeEventListener("abort", onAbort);
		};
		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			cleanup();
			if (error) reject(error);
			else resolve();
		};
		if (signal?.aborted) {
			finish(abortError());
			return;
		}
		signal?.addEventListener("abort", onAbort, { once: true });
		timeoutId = setTimeout(() => finish(new Error("Timed out waiting for stat block render")), EXPORT_ASYNC_TIMEOUT_MS);

		try {
			frameId = requestAnimationFrame(() => finish());
		} catch (error) {
			finish(error instanceof Error ? error : new Error("Unable to schedule stat block render"));
		}
	});
}

function waitForMeasuredStatBlock(article: HTMLElement, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		let frameId: number | undefined;
		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		let settled = false;

		const cleanup = () => {
			if (timeoutId !== undefined) clearTimeout(timeoutId);
			if (frameId !== undefined && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frameId);
			observer?.disconnect();
			signal?.removeEventListener("abort", onAbort);
		};
		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			cleanup();
			if (error) reject(error);
			else resolve();
		};
		const onAbort = () => finish(abortError());
		const check = () => {
			if (article.dataset.statBlockLayout === "measured") finish();
		};
		const observer = typeof MutationObserver === "function" ? new MutationObserver(check) : undefined;

		if (signal?.aborted) {
			finish(abortError());
			return;
		}
		if (!observer) {
			finish(new Error("Unable to wait for stat block layout measurement"));
			return;
		}
		signal?.addEventListener("abort", onAbort, { once: true });
		observer.observe(article, { attributes: true, attributeFilter: ["data-stat-block-layout"] });
		timeoutId = setTimeout(() => finish(new Error("Timed out waiting for stat block layout measurement")), EXPORT_ASYNC_TIMEOUT_MS);
		try {
			frameId = requestAnimationFrame(() => {
				frameId = undefined;
				check();
			});
		} catch (error) {
			finish(error instanceof Error ? error : new Error("Unable to schedule stat block layout measurement"));
		}
	});
}

function errorText(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

function blobToDataUrl(blob: Blob, source: string, signal?: AbortSignal): Promise<string> {
	return new Promise((resolve, reject) => {
		if (typeof FileReader === "undefined") {
			reject(new Error(`Unable to embed resource "${source}": FileReader is unavailable`));
			return;
		}

		const reader = new FileReader();
		let settled = false;
		const timeoutId = setTimeout(() => {
			if (settled) return;
			try {
				reader.abort();
			} finally {
				finish(new Error(`Timed out embedding resource "${source}"`));
			}
		}, EXPORT_ASYNC_TIMEOUT_MS);
		const cleanup = () => {
			clearTimeout(timeoutId);
			reader.onload = null;
			reader.onerror = null;
			reader.onabort = null;
			signal?.removeEventListener("abort", onAbort);
		};
		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			cleanup();
			if (error) reject(error);
			else if (typeof reader.result === "string") resolve(reader.result);
			else reject(new Error(`Unable to embed resource "${source}": FileReader returned no data`));
		};
		const onAbort = () => {
			try {
				reader.abort();
			} finally {
				finish(abortError());
			}
		};

		reader.onload = () => finish();
		reader.onerror = () => finish(new Error(`Unable to read resource "${source}"`));
		reader.onabort = () => finish(new Error(`Unable to read resource "${source}": reading was aborted`));
		if (signal?.aborted) {
			finish(abortError());
			return;
		}
		signal?.addEventListener("abort", onAbort, { once: true });
		try {
			reader.readAsDataURL(blob);
		} catch (error) {
			finish(new Error(`Unable to embed resource "${source}": ${errorText(error, "FileReader failed")}`));
		}
	});
}

async function fetchResourceDataUrl(url: string, signal?: AbortSignal): Promise<string> {
	if (typeof fetch !== "function") throw new Error(`Unable to embed resource "${url}": fetch is unavailable`);
	throwIfAborted(signal);
	const controller = typeof AbortController === "function" ? new AbortController() : undefined;
	const onAbort = () => controller?.abort();
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<never>((_, reject) => {
			timeoutId = setTimeout(() => {
				controller?.abort();
				reject(new Error(`Timed out fetching resource "${url}"`));
			}, EXPORT_ASYNC_TIMEOUT_MS);
	});

	try {
		signal?.addEventListener("abort", onAbort, { once: true });
		const request = fetch(url, controller || signal ? { signal: controller?.signal ?? signal } : undefined).then(async (response) => {
			if (!response.ok) throw new Error(`Resource request returned HTTP ${response.status}`);
			return blobToDataUrl(await response.blob(), url, signal);
		});
		const result = await Promise.race([request, timeout]);
		throwIfAborted(signal);
		return result;
	} catch (error) {
		if (signal?.aborted) throw abortError();
		throw new Error(`Unable to embed resource "${url}": ${errorText(error, "resource request failed")}`);
	} finally {
		if (timeoutId !== undefined) clearTimeout(timeoutId);
		signal?.removeEventListener("abort", onAbort);
	}
}

function firstSrcsetSource(srcset: string): string | undefined {
	const value = srcset.trim();
	if (/^data:/i.test(value)) {
		const dataCandidate = /^(.+?)(?:\s+\d+(?:\.\d+)?[wx])?(?:,\s+|$)/.exec(value)?.[1];
		return dataCandidate?.trim();
	}
	const candidate = value.split(/,\s*/)[0]?.trim();
	return candidate?.split(/\s+/)[0];
}

function selectedImageSource(image: HTMLImageElement): string | undefined {
	return image.currentSrc?.trim() || image.getAttribute("src")?.trim() ||
		(image.getAttribute("srcset") ? firstSrcsetSource(image.getAttribute("srcset")!) : undefined);
}

function isPreservedResourceUrl(source: string): boolean {
	return /^data:/i.test(source) || source.startsWith("#");
}

function resolvedResourceUrl(source: string): string {
	try {
		const baseUrl = window.location.href === "about:blank" ? "http://localhost/" : window.location.href;
		return new URL(source, baseUrl).href;
	} catch (error) {
		throw new Error(`Unable to embed resource "${source}": ${errorText(error, "invalid resource URL")}`);
	}
}

async function embedResource(source: string, signal?: AbortSignal): Promise<string> {
	const value = source.trim();
	if (!value || isPreservedResourceUrl(value)) return value;
	return fetchResourceDataUrl(resolvedResourceUrl(value), signal);
}

async function embedSrcsets(article: HTMLElement, signal?: AbortSignal): Promise<void> {
	for (const element of article.querySelectorAll<HTMLElement>("[srcset]")) {
		throwIfAborted(signal);
		const source = element instanceof HTMLImageElement ? selectedImageSource(element) : firstSrcsetSource(element.getAttribute("srcset") ?? "");
		if (source) element.setAttribute("src", await embedResource(source, signal));
		element.removeAttribute("srcset");
	}
}

function resourceAttributes(element: Element): string[] {
	const tag = element.localName?.toLowerCase();
	const attributes: string[] = [];
	if (element.hasAttribute("src")) attributes.push("src");
	if (element.hasAttribute("poster")) attributes.push("poster");
	if ((tag === "object" || tag === "embed") && element.hasAttribute("data")) attributes.push("data");
	if (tag === "image" || tag === "use" || tag === "feimage") {
		if (element.hasAttribute("href")) attributes.push("href");
		if (element.hasAttribute("xlink:href")) attributes.push("xlink:href");
	}
	return attributes;
}

async function embedResourceAttributes(article: HTMLElement, signal?: AbortSignal): Promise<void> {
	for (const element of [article, ...article.querySelectorAll<HTMLElement>("*")]) {
		for (const attribute of resourceAttributes(element)) {
			throwIfAborted(signal);
			const value = element.getAttribute(attribute);
			if (value !== null) element.setAttribute(attribute, await embedResource(value, signal));
		}
	}
}

const cssUrlPattern = /url\(\s*(?:(['"])(.*?)\1|([^\s)]+))\s*\)/gi;
const cssImportPattern = /@import\s+(?:(['"])(.*?)\1|url\(\s*(?:(['"])(.*?)\3|([^\s)]+))\s*\))/gi;

async function embedCssUrls(css: string, signal?: AbortSignal): Promise<string> {
	for (const match of css.matchAll(cssImportPattern)) {
		const source = (match[2] ?? match[4] ?? match[5])?.trim();
		if (source && !isPreservedResourceUrl(source)) {
			throw new Error(`Unable to embed resource "${source}": external CSS imports are not supported`);
		}
	}

	const matches = [...css.matchAll(cssUrlPattern)];
	if (matches.length === 0) return css;
	let output = "";
	let cursor = 0;
	for (const match of matches) {
		const index = match.index ?? 0;
		const source = (match[2] ?? match[3] ?? "").trim();
		output += css.slice(cursor, index);
		const embedded = await embedResource(source, signal);
		output += isPreservedResourceUrl(source) ? match[0] : `url("${embedded}")`;
		cursor = index + match[0].length;
	}
	return output + css.slice(cursor);
}

async function embedStyles(article: HTMLElement, signal?: AbortSignal): Promise<void> {
	const styledElements = [
		...(article.hasAttribute("style") ? [article] : []),
		...article.querySelectorAll<HTMLElement>("[style]"),
	];
	for (const element of styledElements) {
		throwIfAborted(signal);
		element.setAttribute("style", await embedCssUrls(element.getAttribute("style") ?? "", signal));
	}
	for (const style of article.querySelectorAll<HTMLStyleElement>("style")) {
		throwIfAborted(signal);
		style.textContent = await embedCssUrls(style.textContent ?? "", signal);
	}
}

async function embedResources(article: HTMLElement, signal?: AbortSignal): Promise<void> {
	await embedSrcsets(article, signal);
	await embedResourceAttributes(article, signal);
	await embedStyles(article, signal);
}

function waitForFonts(signal?: AbortSignal): Promise<void> {
	const ready = document.fonts?.ready;
	if (!ready) return Promise.resolve();
	return new Promise((resolve, reject) => {
		let settled = false;
		const timeoutId = setTimeout(() => finish(new Error("Timed out waiting for document fonts")), EXPORT_ASYNC_TIMEOUT_MS);
		const onAbort = () => finish(abortError());
		const cleanup = () => {
			clearTimeout(timeoutId);
			signal?.removeEventListener("abort", onAbort);
		};
		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			cleanup();
			if (error) reject(error);
			else resolve();
		};
		if (signal?.aborted) {
			finish(abortError());
			return;
		}
		signal?.addEventListener("abort", onAbort, { once: true });
		ready.then(() => finish(), (error) => finish(new Error(`Unable to load document fonts: ${errorText(error, "font loading failed")}`)));
	});
}

function roundedDimension(value: number): number {
	return Math.max(1, Math.ceil(value));
}

function imageError(message: string, event?: unknown): Error {
	return event instanceof Error ? event : new Error(message);
}

function imageFromUrl(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		let image: HTMLImageElement;
		try {
			image = new Image();
		} catch (error) {
			reject(error);
			return;
		}

		let settled = false;
		let timeoutId: ReturnType<typeof setTimeout>;
		const onAbort = () => finish(abortError());
		const cleanup = () => {
			clearTimeout(timeoutId);
			image.onload = null;
			image.onerror = null;
			signal?.removeEventListener("abort", onAbort);
		};
		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			cleanup();
			if (error) reject(error);
			else resolve(image);
		};
		if (signal?.aborted) {
			finish(abortError());
			return;
		}
		signal?.addEventListener("abort", onAbort, { once: true });
		timeoutId = setTimeout(() => finish(new Error("Timed out loading SVG export image")), EXPORT_ASYNC_TIMEOUT_MS);

		image.onload = () => finish();
		image.onerror = (event) => finish(imageError("Unable to load SVG export image", event));
		try {
			image.src = url;
		} catch (error) {
			finish(error instanceof Error ? error : new Error("Unable to load SVG export image"));
		}
	});
}

interface ImageWait {
	promise: Promise<void>;
	cancel: () => void;
}

function waitForImage(image: HTMLImageElement, signal?: AbortSignal): ImageWait {
	if (!image.hasAttribute("src") && !image.hasAttribute("srcset") && !image.currentSrc && !image.src) {
		return { promise: Promise.resolve(), cancel: () => undefined };
	}

	let cancel: () => void = () => undefined;
	const promise = new Promise<void>((resolve, reject) => {
		let settled = false;
		let timeoutId: ReturnType<typeof setTimeout>;
		const onAbort = () => finish(abortError());
		const cleanup = () => {
			clearTimeout(timeoutId);
			image.removeEventListener("load", onLoad);
			image.removeEventListener("error", onError);
			signal?.removeEventListener("abort", onAbort);
		};
		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			cleanup();
			if (error) reject(error);
			else resolve();
		};
		const onLoad = () => {
			if (typeof image.decode !== "function") {
				finish();
				return;
			}
			try {
				image.decode().then(() => finish(), (error) => finish(imageError("Failed to decode stat block image", error)));
			} catch (error) {
				finish(imageError("Failed to decode stat block image", error));
			}
		};
		const onError = (event: Event) => finish(imageError("Failed to load stat block image", event));
		cancel = () => finish(new Error("Cancelled waiting for stat block images"));
		if (signal?.aborted) {
			finish(abortError());
			return;
		}
		signal?.addEventListener("abort", onAbort, { once: true });
		image.addEventListener("load", onLoad);
		image.addEventListener("error", onError);
		timeoutId = setTimeout(() => finish(new Error("Timed out waiting for stat block images")), EXPORT_ASYNC_TIMEOUT_MS);

		if (image.complete) {
			if (image.naturalWidth === 0) onError(new Event("error"));
			else onLoad();
		}
	});

	return { promise, cancel };
}

async function waitForImages(article: HTMLElement, signal?: AbortSignal): Promise<void> {
	const waits = [...article.querySelectorAll<HTMLImageElement>("img")].map((image) => waitForImage(image, signal));
	try {
		await Promise.all(waits.map(({ promise }) => promise));
	} catch (error) {
		for (const wait of waits) wait.cancel();
		throw error;
	}
}

function rasterizeSvg(svg: string, mime: string, width: number, height: number, signal?: AbortSignal): Promise<string> {
	// Chromium taints canvases for blob URLs containing foreignObject; data URLs remain origin-clean.
	const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

	return imageFromUrl(dataUrl, signal)
		.then((image) => {
			throwIfAborted(signal);
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			if (typeof canvas.getContext !== "function" || typeof canvas.toDataURL !== "function") {
				throw new Error("Browser canvas APIs are unavailable");
			}
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Unable to create a 2D canvas context");

			context.drawImage(image, 0, 0, width, height);
			throwIfAborted(signal);
			const dataUrl = canvas.toDataURL(mime);
			if (!dataUrl.startsWith(`data:${mime};`) && !dataUrl.startsWith(`data:${mime},`)) {
				throw new UnsupportedEncoderError(mime);
			}
			return dataUrl;
		});
}

function visualFormat(format: RenderVisualExportOptions["format"]): { mime: string } {
	const definition = EXPORT_FORMATS.find((item) => item.key === format);
	if (!definition) throw new Error(`Unknown visual export format: ${format}`);
	return definition;
}

export async function renderVisualExport({
	monster,
	theme,
	format,
	previewWidth,
	signal,
}: RenderVisualExportOptions): Promise<RenderedVisualExport> {
	assertBrowserEnvironment();
	throwIfAborted(signal);
	if (!Number.isFinite(previewWidth) || previewWidth <= 0) {
		throw new Error("Preview width must be positive");
	}

	const container = document.createElement("div");
	container.style.position = "fixed";
	container.style.left = "-100000px";
	container.style.top = "0";
	container.style.width = `${previewWidth}px`;
	container.style.margin = "0";
	container.style.padding = "0";
	container.style.visibility = "hidden";

	const style = document.createElement("style");
	style.textContent = statBlockStyles;
	container.append(style);
	document.body.append(container);

	let component: ReturnType<typeof mount> | undefined;
	try {
		component = mount(StatBlock, {
			target: container,
			props: {
				preview: createPreviewModel(monster),
				theme,
				idPrefix: nextExportIdPrefix(),
				twoColumn: monster.two_column ?? false,
			},
		});
		flushSync();
		await waitForAnimationFrame(signal);

		const article = container.querySelector<HTMLElement>("article.stat-block");
		if (!article) throw new Error("Rendered stat block article was not found");
		await embedResources(article, signal);
		await waitForImages(article, signal);
		await waitForFonts(signal);
		if (monster.two_column) await waitForMeasuredStatBlock(article, signal);

		const rect = article.getBoundingClientRect();
		const width = roundedDimension(rect.width);
		const height = roundedDimension(rect.height);
		const { mime } = visualFormat(format);
		const block = { title: monster.name?.trim() || "Monster", markup: article.outerHTML, css: statBlockStyles, width, height, theme };

		if (format === "html") {
			return { content: serializeStandaloneHtml(block), mime, width, height };
		}
		if (format === "svg") {
			return { content: serializeStandaloneSvg(block), mime, width, height };
		}

		const svg = serializeStandaloneSvg(block);
		const content = await rasterizeSvg(svg, mime, width, height, signal);
		return { content, mime, width, height };
	} finally {
		try {
			if (component) unmount(component);
		} finally {
			container.remove();
		}
	}
}
