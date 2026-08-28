// @vitest-environment jsdom

import { flushSync, mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import PreviewThemePicker from "../../src/lib/components/preview/PreviewThemePicker.svelte";
import { get } from "svelte/store";
import {
	mode,
	previewTheme,
	selectedDarkTheme,
	selectedLightTheme,
	setPreviewTheme,
} from "../../src/lib/state/theme-store";
import { DARK_THEME_KEYS, LIGHT_THEME_KEYS } from "../../src/lib/theme/palettes";

let mounted: ReturnType<typeof mount> | undefined;

beforeEach(() => {
	setPreviewTheme("catppuccin-latte");
	mode.set("light");
	selectedLightTheme.set("catppuccin-latte");
	selectedDarkTheme.set("catppuccin-mocha");
});

afterEach(() => {
	if (mounted) unmount(mounted);
	mounted = undefined;
	document.body.replaceChildren();
	setPreviewTheme("catppuccin-latte");
});

describe("PreviewThemePicker", () => {
	it("lists site palettes and Monster Manual variants", () => {
		mounted = mount(PreviewThemePicker, { target: document.body });
		flushSync();

		const select = document.querySelector<HTMLSelectElement>("#preview-theme");
		expect(select).not.toBeNull();
		for (const key of [...LIGHT_THEME_KEYS, ...DARK_THEME_KEYS]) {
			expect(select?.querySelector(`[value="${key}"]`)).not.toBeNull();
		}
		expect(select?.querySelector('[value="monster-manual-smooth"]')?.textContent)
			.toBe("Monster Manual (smooth)");
		expect(select?.querySelector('[value="monster-manual-textured"]')).not.toBeNull();
	});

	it("has an accessible label, helper text, and theme groups", () => {
		mounted = mount(PreviewThemePicker, { target: document.body });
		flushSync();

		const select = document.querySelector<HTMLSelectElement>("#preview-theme");
		expect(document.querySelector('label[for="preview-theme"]')?.textContent).toBe("Stat block theme");
		expect(select?.getAttribute("aria-describedby")).toBe("preview-theme-help");
		expect(document.getElementById("preview-theme-help")).not.toBeNull();
		expect(document.querySelector(".preview-theme-picker__help")?.textContent).toContain(
			"Site theme changes synchronize this preview",
		);
		expect([...select?.querySelectorAll("optgroup") ?? []].map((group) => group.label)).toEqual([
			"Light",
			"Dark",
			"Monster Manual",
		]);
	});

	it("supports a custom ID prefix and tracks programmatic preview changes", () => {
		mounted = mount(PreviewThemePicker, {
			target: document.body,
			props: { idPrefix: "alternate-preview-theme" },
		});
		flushSync();

		const select = document.querySelector<HTMLSelectElement>("#alternate-preview-theme");
		expect(select?.getAttribute("aria-describedby")).toBe("alternate-preview-theme-help");
		expect(document.querySelector('label[for="alternate-preview-theme"]')).not.toBeNull();
		expect(document.getElementById("alternate-preview-theme-help")).not.toBeNull();

		setPreviewTheme("nord-dark");
		flushSync();
		expect(select?.value).toBe("nord-dark");
	});

	it("changes only the preview theme", () => {
		mounted = mount(PreviewThemePicker, { target: document.body });
		const select = document.querySelector<HTMLSelectElement>("#preview-theme")!;
		const initialMode = get(mode);
		const initialLightTheme = get(selectedLightTheme);
		const initialDarkTheme = get(selectedDarkTheme);
		const initialPreference = window.localStorage.getItem("theme.pref");

		select.value = "monster-manual-textured";
		select.dispatchEvent(new Event("change", { bubbles: true }));
		flushSync();

		expect(get(previewTheme)).toBe("monster-manual-textured");
		expect(get(mode)).toBe(initialMode);
		expect(get(selectedLightTheme)).toBe("catppuccin-latte");
		expect(get(selectedLightTheme)).toBe(initialLightTheme);
		expect(get(selectedDarkTheme)).toBe(initialDarkTheme);
		expect(window.localStorage.getItem("theme.pref")).toBe(initialPreference);
	});
});
