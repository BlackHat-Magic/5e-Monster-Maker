// @vitest-environment jsdom

import { flushSync, mount, unmount } from "svelte";
import { get } from "svelte/store";
import { afterEach, describe, expect, it, vi } from "vitest";
import FileActions from "../../src/lib/components/app-shell/FileActions.svelte";
import { IMPORT_SIZE_LIMIT } from "../../src/lib/components/app-shell/file-actions";
import { createDefaultMonster } from "../../src/lib/monster/defaults";
import { importMonsterToml } from "../../src/lib/monster/toml";
import { monster, notice } from "../../src/lib/state/monster-store";

vi.mock("../../src/lib/monster/toml", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/lib/monster/toml")>()),
	importMonsterToml: vi.fn(),
}));

const mockedImportMonsterToml = vi.mocked(importMonsterToml);

describe("FileActions import warning notice", () => {
	afterEach(() => {
		document.body.replaceChildren();
		notice.set(null);
		mockedImportMonsterToml.mockReset();
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
});
