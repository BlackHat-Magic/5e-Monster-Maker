// @vitest-environment jsdom

import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import FileActions from "../../src/lib/components/app-shell/FileActions.svelte";
import { createDefaultMonster } from "../../src/lib/monster/defaults";
import { importMonsterToml } from "../../src/lib/monster/toml";
import { notice } from "../../src/lib/state/monster-store";

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

		(document.querySelector('button[type="button"]:not([aria-label])') as HTMLButtonElement).click();
		flushSync();
		expect(document.querySelector('[data-testid="import-warnings"]')).toBeNull();
		expect(noticeRegion?.textContent).toContain("Imported TOML successfully. Warnings are available for review.");

		unmount(component);
	});
});
