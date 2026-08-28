// @vitest-environment jsdom

import { flushSync, mount, unmount } from "svelte";
import { get } from "svelte/store";
import { afterEach, describe, expect, it, vi } from "vitest";
import FileActions from "../../src/lib/components/app-shell/FileActions.svelte";
import { IMPORT_SIZE_LIMIT } from "../../src/lib/components/app-shell/file-actions";
import { createDefaultMonster } from "../../src/lib/monster/defaults";
import { importMonsterToml } from "../../src/lib/monster/toml";
import { monster, notice } from "../../src/lib/state/monster-store";
import { previewTheme, setPreviewTheme } from "../../src/lib/state/theme-store";
import { renderVisualExport } from "../../src/lib/monster/export-renderer";

vi.mock("../../src/lib/monster/toml", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/lib/monster/toml")>()),
	importMonsterToml: vi.fn(),
}));

vi.mock("../../src/lib/monster/export-renderer", () => ({
	renderVisualExport: vi.fn(),
}));

const mockedImportMonsterToml = vi.mocked(importMonsterToml);
const mockedRenderVisualExport = vi.mocked(renderVisualExport);
let mounted: ReturnType<typeof mount> | undefined;

function clickExport(): void {
	document.querySelector<HTMLButtonElement>('[aria-label="Export"]')?.click();
	flushSync();
}

function clickConfirm(): void {
	document.querySelector<HTMLButtonElement>('[data-export-confirm]')?.click();
	flushSync();
}

function addPreview(width = 420): void {
	const preview = document.createElement("article");
	preview.className = "stat-block";
	Object.defineProperty(preview, "getBoundingClientRect", {
		configurable: true,
		value: () => ({ width, height: 600 }),
	});
	document.body.append(preview);
}

describe("FileActions import warning notice", () => {
	afterEach(() => {
	if (mounted) unmount(mounted);
	mounted = undefined;
	document.body.replaceChildren();
	notice.set(null);
	window.localStorage.removeItem("monster-maker.export-format");
	mockedImportMonsterToml.mockReset();
	mockedRenderVisualExport.mockReset();
	vi.restoreAllMocks();
	vi.useRealTimers();
	});

	describe("export dialog", () => {
		it("opens with PNG and the current preview theme", () => {
			setPreviewTheme("monster-manual-textured");
			mounted = mount(FileActions, { target: document.body });
			clickExport();

			expect(document.querySelector('[role="dialog"]')).not.toBeNull();
			expect(document.querySelector('[role="radiogroup"]')?.getAttribute("aria-labelledby")).toBe("export-format-label");
			expect(document.querySelector<HTMLButtonElement>('[data-export-format="png"]')?.getAttribute("role")).toBe("radio");
			expect(document.querySelector<HTMLButtonElement>('[data-export-format="png"]')?.getAttribute("aria-checked")).toBe("true");
			expect(document.querySelector<HTMLSelectElement>('[aria-label="Export theme"]')?.value).toBe("monster-manual-textured");
		});

		it("supports radio keyboard navigation across available formats", () => {
			mounted = mount(FileActions, { target: document.body });
			clickExport();
			const png = document.querySelector<HTMLButtonElement>('[data-export-format="png"]')!;
			const svg = document.querySelector<HTMLButtonElement>('[data-export-format="svg"]')!;
			const toml = document.querySelector<HTMLButtonElement>('[data-export-format="toml"]')!;
			const html = document.querySelector<HTMLButtonElement>('[data-export-format="html"]')!;
			const webp = document.querySelector<HTMLButtonElement>('[data-export-format="webp"]')!;

			expect(webp.getAttribute("role")).toBe("radio");
			expect(webp.disabled).toBe(true);
			expect(png.tabIndex).toBe(0);
			expect(svg.tabIndex).toBe(-1);

			png.focus();
			png.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowRight" }));
			flushSync();
			expect(document.activeElement).toBe(svg);
			expect(svg.getAttribute("aria-checked")).toBe("true");
			expect(png.getAttribute("aria-checked")).toBe("false");

			svg.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Home" }));
			flushSync();
			expect(document.activeElement).toBe(toml);
			expect(toml.getAttribute("aria-checked")).toBe("true");

			toml.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "End" }));
			flushSync();
			expect(document.activeElement).toBe(html);
			expect(html.getAttribute("aria-checked")).toBe("true");
		});

		it("remembers the last format but refreshes the theme from the preview", () => {
			window.localStorage.setItem("monster-maker.export-format", "svg");
			setPreviewTheme("catppuccin-latte");
			mounted = mount(FileActions, { target: document.body });
			clickExport();

			expect(document.querySelector<HTMLButtonElement>('[data-export-format="svg"]')?.getAttribute("aria-checked")).toBe("true");
			expect(document.querySelector<HTMLSelectElement>('[aria-label="Export theme"]')?.value).toBe("catppuccin-latte");
		});

		it("keeps unsupported raster formats disabled", () => {
			vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,ok");
			mounted = mount(FileActions, { target: document.body });
			clickExport();

			expect(document.querySelector<HTMLButtonElement>('[data-export-format="avif"]')?.disabled).toBe(true);
			expect(document.querySelector('[data-export-format-help="avif"]')?.textContent).toContain("cannot encode");
			expect(document.querySelector<HTMLButtonElement>('[data-export-format="avif"]')?.getAttribute("title")).toContain("cannot encode");
			expect(document.querySelector('[data-export-format-help="avif"]')?.tagName).toBe("SPAN");
			expect(document.querySelector('[data-export-format-help="avif"]')?.getAttribute("tabindex")).toBeNull();
			expect(document.querySelector('[data-export-format-help="avif"]')?.getAttribute("aria-disabled")).toBeNull();
			expect(document.querySelector<HTMLButtonElement>('[data-export-format="avif"]')?.getAttribute("aria-describedby")).toBe("export-format-help-avif");
		});

		it("falls back to PNG when a remembered raster format is unsupported", () => {
			window.localStorage.setItem("monster-maker.export-format", "webp");
			vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,ok");
			mounted = mount(FileActions, { target: document.body });
			clickExport();

			expect(document.querySelector<HTMLButtonElement>('[data-export-format="png"]')?.getAttribute("aria-checked")).toBe("true");
			expect(document.querySelector<HTMLButtonElement>('[data-export-format="webp"]')?.disabled).toBe(true);
		});

		it("changes export theme without changing the preview theme", () => {
			setPreviewTheme("catppuccin-latte");
			mounted = mount(FileActions, { target: document.body });
			clickExport();
			const select = document.querySelector<HTMLSelectElement>('[aria-label="Export theme"]') as HTMLSelectElement;
			select.value = "monster-manual-smooth";
			select.dispatchEvent(new Event("change", { bubbles: true }));
			flushSync();

			expect(get(previewTheme)).toBe("catppuccin-latte");
			expect(select.value).toBe("monster-manual-smooth");
		});

		it("downloads TOML without requiring a preview", () => {
			mounted = mount(FileActions, { target: document.body });
			clickExport();
			document.querySelector<HTMLButtonElement>('[data-export-format="toml"]')?.click();
			flushSync();
			let downloadedBlob: Blob | undefined;
			const createObjectURL = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
				downloadedBlob = blob as Blob;
				return "blob:toml";
			});

			clickConfirm();

			expect(createObjectURL).toHaveBeenCalledOnce();
			expect(downloadedBlob?.type).toBe("application/toml");
			expect(document.querySelector('[role="dialog"]')).toBeNull();
			expect(window.localStorage.getItem("monster-maker.export-format")).toBe("toml");
			expect(get(notice)?.message).toMatch(/^Exported .+\.toml\.$/);
		});

		it("downloads a visual export with the measured preview width", async () => {
			mockedRenderVisualExport.mockResolvedValue({ content: "<svg />", mime: "image/svg+xml", width: 420, height: 600 });
			mounted = mount(FileActions, { target: document.body });
			clickExport();
			document.querySelector<HTMLButtonElement>('[data-export-format="svg"]')?.click();
			addPreview();
			const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:svg");

			clickConfirm();
			await vi.waitFor(() => expect(mockedRenderVisualExport).toHaveBeenCalled());
			await vi.waitFor(() => expect(get(notice)?.message).toMatch(/^Exported .+\.svg\.$/));

			expect(mockedRenderVisualExport).toHaveBeenCalledWith(expect.objectContaining({ format: "svg", previewWidth: 420 }));
			expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
			expect(window.localStorage.getItem("monster-maker.export-format")).toBe("svg");
			expect(document.querySelector('[role="dialog"]')).toBeNull();
		});

		it("decodes raster data URLs into binary Blobs with the returned MIME", async () => {
			let downloadedBlob: Blob | undefined;
			mockedRenderVisualExport.mockResolvedValue({ content: "data:image/png;base64,AAH/", mime: "image/png", width: 420, height: 600 });
			mounted = mount(FileActions, { target: document.body });
			clickExport();
			document.querySelector<HTMLButtonElement>('[data-export-format="png"]')?.click();
			addPreview();
			vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
				downloadedBlob = blob as Blob;
				return "blob:png";
			});

			clickConfirm();
			await vi.waitFor(() => expect(get(notice)?.message).toMatch(/^Exported .+\.png\.$/));

			expect(downloadedBlob?.type).toBe("image/png");
			expect([...new Uint8Array(await downloadedBlob!.arrayBuffer())]).toEqual([0, 1, 255]);
			expect(await downloadedBlob!.text()).not.toContain("data:image/png");
		});

		it("keeps the dialog open and idle work pending while a visual export is deferred", async () => {
			let resolveRender!: (value: { content: string; mime: string; width: number; height: number }) => void;
			mockedRenderVisualExport.mockImplementation(() => new Promise((resolve) => {
				resolveRender = resolve;
			}));
			const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:svg");
			mounted = mount(FileActions, { target: document.body });
			clickExport();
			document.querySelector<HTMLButtonElement>('[data-export-format="svg"]')?.click();
			addPreview();

			clickConfirm();
			await vi.waitFor(() => expect(mockedRenderVisualExport).toHaveBeenCalled());
			const cancel = document.querySelector<HTMLButtonElement>('[data-export-cancel]');
			const theme = document.querySelector<HTMLSelectElement>('[aria-label="Export theme"]');
			expect(cancel?.disabled).toBe(true);
			expect(theme?.disabled).toBe(true);
			expect(document.querySelector<HTMLButtonElement>('[data-export-format="svg"]')?.disabled).toBe(true);
			cancel?.click();
			document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
			flushSync();

			expect(document.querySelector('[role="dialog"]')).not.toBeNull();
			expect(createObjectURL).not.toHaveBeenCalled();
			expect(window.localStorage.getItem("monster-maker.export-format")).toBeNull();

			resolveRender({ content: "<svg />", mime: "image/svg+xml", width: 420, height: 600 });
			await vi.waitFor(() => expect(get(notice)?.message).toMatch(/^Exported .+\.svg\.$/));
			expect(createObjectURL).toHaveBeenCalledOnce();
			expect(window.localStorage.getItem("monster-maker.export-format")).toBe("svg");
			expect(document.querySelector('[role="dialog"]')).toBeNull();
		});

		it("does not persist or close after a visual export failure", async () => {
			mockedRenderVisualExport.mockRejectedValue(new Error("encoder failed"));
			mounted = mount(FileActions, { target: document.body });
			clickExport();
			document.querySelector<HTMLButtonElement>('[data-export-format="svg"]')?.click();
			addPreview();

			clickConfirm();
			await vi.waitFor(() => expect(get(notice)?.kind).toBe("error"));

			expect(get(notice)?.message).toContain("encoder failed");
			const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
			expect(dialog?.querySelector('[role="alert"]')?.textContent).toContain("encoder failed");
			expect(dialog?.getAttribute("aria-describedby")).toBe("export-description");
			expect(document.getElementById("export-description")?.textContent).toContain("encoder failed");
			expect(window.localStorage.getItem("monster-maker.export-format")).toBeNull();
			expect(document.querySelector('[role="dialog"]')).not.toBeNull();
			expect(document.querySelector<HTMLButtonElement>('[data-export-cancel]')?.disabled).toBe(false);
			expect(document.querySelector<HTMLSelectElement>('[aria-label="Export theme"]')?.disabled).toBe(false);
		});

		it("does not download or mutate state after unmounting a pending export", async () => {
			let resolveRender!: (value: { content: string; mime: string; width: number; height: number }) => void;
			mockedRenderVisualExport.mockImplementation(() => new Promise((resolve) => {
				resolveRender = resolve;
			}));
			const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:svg");
			mounted = mount(FileActions, { target: document.body });
			clickExport();
			document.querySelector<HTMLButtonElement>('[data-export-format="svg"]')?.click();
			addPreview();

			clickConfirm();
			await vi.waitFor(() => expect(mockedRenderVisualExport).toHaveBeenCalled());
			unmount(mounted);
			mounted = undefined;
			resolveRender({ content: "<svg />", mime: "image/svg+xml", width: 420, height: 600 });
			await Promise.resolve();
			await Promise.resolve();

			expect(createObjectURL).not.toHaveBeenCalled();
			expect(window.localStorage.getItem("monster-maker.export-format")).toBeNull();
			expect(get(notice)).toBeNull();
		});

		it("closes after download when format persistence fails", () => {
			mounted = mount(FileActions, { target: document.body });
			clickExport();
			document.querySelector<HTMLButtonElement>('[data-export-format="toml"]')?.click();
			vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:toml");
			vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
				throw new Error("storage unavailable");
			});

			clickConfirm();

			expect(document.querySelector('[role="dialog"]')).toBeNull();
			expect(get(notice)?.kind).toBe("error");
			expect(get(notice)?.message).toContain("Exported");
		});

		it("reports a missing preview and leaves the dialog open", () => {
			mounted = mount(FileActions, { target: document.body });
			clickExport();
			document.querySelector<HTMLButtonElement>('[data-export-format="svg"]')?.click();

			clickConfirm();

			expect(mockedRenderVisualExport).not.toHaveBeenCalled();
			expect(get(notice)?.kind).toBe("error");
			expect(get(notice)?.message).toContain("preview");
			expect(document.querySelector('[role="dialog"]')).not.toBeNull();
		});

		it("revokes the download URL on the next task", async () => {
			mounted = mount(FileActions, { target: document.body });
			clickExport();
			document.querySelector<HTMLButtonElement>('[data-export-format="toml"]')?.click();
			const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:toml");
			const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

			clickConfirm();
			expect(revokeObjectURL).not.toHaveBeenCalled();
			expect(createObjectURL).toHaveBeenCalledOnce();
			await new Promise((resolve) => window.setTimeout(resolve, 0));
			expect(revokeObjectURL).toHaveBeenCalledWith("blob:toml");
		});

		it("cancels without changing export state", () => {
			setPreviewTheme("catppuccin-latte");
			mounted = mount(FileActions, { target: document.body });
			clickExport();
			const select = document.querySelector<HTMLSelectElement>('[aria-label="Export theme"]') as HTMLSelectElement;
			select.value = "monster-manual-smooth";
			select.dispatchEvent(new Event("change", { bubbles: true }));
			document.querySelector<HTMLButtonElement>('[data-export-cancel]')?.click();
			flushSync();

			expect(get(previewTheme)).toBe("catppuccin-latte");
			expect(document.querySelector('[role="dialog"]')).toBeNull();
		});
	});

	it("renders and announces every warning from a successful import", async () => {
		const warnings = [
			{ path: "basics.extra", message: "Unsupported key: basics.extra" },
			{ path: "action[0].spells[1][0]", message: "Expected a non-negative safe integer; the value was replaced with 0." },
		];
		mockedImportMonsterToml.mockReturnValue({ ok: true, monster: createDefaultMonster(), warnings });

		const component = mount(FileActions, { target: document.body });
		const input = document.querySelector<HTMLInputElement>("#monster-file-input");
		expect(input).not.toBeNull();
		const file = new File(["ignored by the mocked parser"], "warning.toml", { type: "text/plain" });
		Object.defineProperty(input, "files", { configurable: true, value: [file] });
		input?.dispatchEvent(new Event("change", { bubbles: true }));

		await vi.waitFor(() => expect(mockedImportMonsterToml).toHaveBeenCalledWith("ignored by the mocked parser"));
		flushSync();

		const noticeRegion = document.querySelector<HTMLElement>('[data-testid="notice-region"]');
		expect(noticeRegion?.getAttribute("aria-live")).toBe("polite");
		expect(noticeRegion?.getAttribute("aria-atomic")).toBe("true");
		expect(noticeRegion?.textContent).toContain("Imported TOML successfully. Warnings are available for review.");

		const warningRegion = document.querySelector<HTMLElement>('[data-testid="import-warnings"]');
		expect(warningRegion?.getAttribute("role")).toBe("alert");
		expect(document.getElementById("import-warnings-heading")?.textContent).toBe("Import warnings");
		for (const warning of warnings) {
			expect(warningRegion?.textContent).toContain(warning.path);
			expect(warningRegion?.textContent).toContain(warning.message);
			expect(warningRegion?.querySelector(`li[aria-label="${warning.path}: ${warning.message}"]`)).not.toBeNull();
		}

		(document.querySelector('.toast__dismiss') as HTMLButtonElement).click();
		flushSync();
		expect(document.querySelector('[data-testid="import-warnings"]')).toBeNull();
		expect(noticeRegion?.textContent).toContain("Imported TOML successfully. Warnings are available for review.");

		unmount(component);
	});

	it("clears warnings before a later malformed import", async () => {
		mockedImportMonsterToml
			.mockReturnValueOnce({ ok: true, monster: createDefaultMonster(), warnings: [{ path: "basics.extra", message: "Unsupported key" }] })
			.mockReturnValueOnce({ ok: false, message: "Unable to parse TOML" });
		const component = mount(FileActions, { target: document.body });
		const input = document.querySelector<HTMLInputElement>("#monster-file-input");
		const firstFile = new File(["first"], "first.toml", { type: "text/plain" });
		const secondFile = new File(["second"], "second.toml", { type: "text/plain" });

		Object.defineProperty(input, "files", { configurable: true, value: [firstFile] });
		input?.dispatchEvent(new Event("change", { bubbles: true }));
		await vi.waitFor(() => expect(document.querySelector('[data-testid="import-warnings"]')).not.toBeNull());

		Object.defineProperty(input, "files", { configurable: true, value: [secondFile] });
		input?.dispatchEvent(new Event("change", { bubbles: true }));
		await vi.waitFor(() => expect(get(notice)?.message).toBe("Unable to parse TOML"));
		flushSync();

		expect(document.querySelector('[data-testid="import-warnings"]')).toBeNull();
		unmount(component);
	});

	it("preserves persistence errors during Import and New", async () => {
		mockedImportMonsterToml.mockReturnValue({ ok: true, monster: createDefaultMonster(), warnings: [] });
		vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
			throw new Error("storage unavailable");
		});
		const component = mount(FileActions, { target: document.body });
		const input = document.querySelector<HTMLInputElement>("#monster-file-input");
		const file = new File(["import"], "import.toml", { type: "text/plain" });
		Object.defineProperty(input, "files", { configurable: true, value: [file] });
		input?.dispatchEvent(new Event("change", { bubbles: true }));
		await vi.waitFor(() => expect(get(notice)?.kind).toBe("error"));
		flushSync();

		expect(get(notice)?.message).toContain("Local persistence is unavailable");
		expect(get(notice)?.message).not.toContain("Imported TOML successfully");

		(document.querySelector('[aria-label="New"]') as HTMLButtonElement).click();
		flushSync();
		expect(get(notice)?.kind).toBe("error");
		expect(get(notice)?.message).toContain("Local persistence is unavailable");
		expect(get(notice)?.message).not.toContain("Started a new monster draft");
		unmount(component);
	});

	it("clears warnings before an unreadable import", async () => {
		mockedImportMonsterToml.mockReturnValue({
			ok: true,
			monster: createDefaultMonster(),
			warnings: [{ path: "basics.extra", message: "Unsupported key" }],
		});
		const component = mount(FileActions, { target: document.body });
		const input = document.querySelector<HTMLInputElement>("#monster-file-input");
		const readableFile = new File(["readable"], "readable.toml", { type: "text/plain" });
		const unreadableFile = new File([], "unreadable.toml", { type: "text/plain" });
		Object.defineProperty(unreadableFile, "text", { configurable: true, value: () => Promise.reject(new Error("read failed")) });

		Object.defineProperty(input, "files", { configurable: true, value: [readableFile] });
		input?.dispatchEvent(new Event("change", { bubbles: true }));
		await vi.waitFor(() => expect(document.querySelector('[data-testid="import-warnings"]')).not.toBeNull());

		Object.defineProperty(input, "files", { configurable: true, value: [unreadableFile] });
		input?.dispatchEvent(new Event("change", { bubbles: true }));
		await vi.waitFor(() => expect(get(notice)?.message).toContain("Unable to read"));
		flushSync();

		expect(document.querySelector('[data-testid="import-warnings"]')).toBeNull();
		unmount(component);
	});

	it("resets the picker when an oversized import is rejected", async () => {
		const component = mount(FileActions, { target: document.body });
		const input = document.querySelector<HTMLInputElement>("#monster-file-input");
		const valueSetter = vi.fn();
		Object.defineProperty(input, "value", { configurable: true, get: () => "", set: valueSetter });
		const oversizedFile = new File([new Uint8Array(IMPORT_SIZE_LIMIT + 1)], "large.toml", { type: "text/plain" });

		Object.defineProperty(input, "files", { configurable: true, value: [oversizedFile] });
		input?.dispatchEvent(new Event("change", { bubbles: true }));
		await vi.waitFor(() => expect(get(notice)?.message).toContain("too large"));
		flushSync();

		expect(valueSetter).toHaveBeenCalledWith("");
		expect(mockedImportMonsterToml).not.toHaveBeenCalled();
		unmount(component);
	});

	it("ignores an older import when a newer file finishes first", async () => {
		monster.set(createDefaultMonster());
		let resolveOlder!: (value: string) => void;
		let resolveNewer!: (value: string) => void;
		const olderText = new Promise<string>((resolve) => (resolveOlder = resolve));
		const newerText = new Promise<string>((resolve) => (resolveNewer = resolve));
		const olderFile = new File([], "older.toml", { type: "text/plain" });
		const newerFile = new File([], "newer.toml", { type: "text/plain" });
		Object.defineProperty(olderFile, "text", { configurable: true, value: () => olderText });
		Object.defineProperty(newerFile, "text", { configurable: true, value: () => newerText });
		mockedImportMonsterToml.mockImplementation((text) => ({
			ok: true,
			monster: { ...createDefaultMonster(), name: text === "newer" ? "Newer" : "Older" },
			warnings: [],
		}));

		const component = mount(FileActions, { target: document.body });
		const input = document.querySelector<HTMLInputElement>("#monster-file-input");
		Object.defineProperty(input, "files", { configurable: true, value: [olderFile] });
		input?.dispatchEvent(new Event("change", { bubbles: true }));
		Object.defineProperty(input, "files", { configurable: true, value: [newerFile] });
		input?.dispatchEvent(new Event("change", { bubbles: true }));

		resolveNewer("newer");
		await vi.waitFor(() => expect(get(monster).name).toBe("Newer"));
		resolveOlder("older");
		await vi.waitFor(() => expect(mockedImportMonsterToml).toHaveBeenCalledTimes(1));
		flushSync();

		expect(get(monster).name).toBe("Newer");
		unmount(component);
	});

	it("invalidates a slow import when New replaces the draft", async () => {
		monster.set(createDefaultMonster());
		let resolveImport!: (value: string) => void;
		const slowText = new Promise<string>((resolve) => (resolveImport = resolve));
		const slowFile = new File([], "slow.toml", { type: "text/plain" });
		Object.defineProperty(slowFile, "text", { configurable: true, value: () => slowText });
		mockedImportMonsterToml.mockReturnValue({
			ok: true,
			monster: { ...createDefaultMonster(), name: "Stale import" },
			warnings: [],
		});

		const component = mount(FileActions, { target: document.body });
		const input = document.querySelector<HTMLInputElement>("#monster-file-input");
		Object.defineProperty(input, "files", { configurable: true, value: [slowFile] });
		input?.dispatchEvent(new Event("change", { bubbles: true }));
		(document.querySelector('[aria-label="New"]') as HTMLButtonElement).click();
		flushSync();

		expect(get(notice)?.message).toBe("Started a new monster draft.");
		expect(get(monster).name).toBe(createDefaultMonster().name);

		resolveImport("slow");
		await slowText;
		await Promise.resolve();
		flushSync();

		expect(mockedImportMonsterToml).not.toHaveBeenCalled();
		expect(get(monster).name).toBe(createDefaultMonster().name);
		unmount(component);
	});

	it("does not apply a pending import after unmount", async () => {
		let resolveImport!: (value: string) => void;
		const slowText = new Promise<string>((resolve) => (resolveImport = resolve));
		const slowFile = new File([], "slow.toml", { type: "text/plain" });
		Object.defineProperty(slowFile, "text", { configurable: true, value: () => slowText });
		mockedImportMonsterToml.mockReturnValue({
			ok: true,
			monster: { ...createDefaultMonster(), name: "Stale import" },
			warnings: [],
		});
		const component = mount(FileActions, { target: document.body });
		const input = document.querySelector<HTMLInputElement>("#monster-file-input");
		flushSync();
		Object.defineProperty(input, "files", { configurable: true, value: [slowFile] });
		input?.dispatchEvent(new Event("change", { bubbles: true }));
		await unmount(component, { outro: true });
		flushSync();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.querySelector('[aria-label="Import"]')).toBeNull();
		resolveImport("slow");
		await slowText;
		await Promise.resolve();
		await Promise.resolve();

		expect(mockedImportMonsterToml).not.toHaveBeenCalled();
		expect(get(notice)).toBeNull();
	});
});
