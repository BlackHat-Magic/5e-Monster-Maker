// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { createDefaultMonster } from "../../src/lib/monster/defaults";
import {
  monster,
  notice,
  replacementEpoch,
  replaceMonster,
  resetMonster,
  restoreMonster,
} from "../../src/lib/state/monster-store";
import {
  darkTheme,
  initTheme,
  mode,
  previewTheme,
  selectedDarkTheme,
  selectedLightTheme,
  setDarkTheme,
  setLightTheme,
  setPreviewTheme,
  toggleMode,
} from "../../src/lib/state/theme-store";
import { isThemeKey } from "../../src/lib/theme/palettes";

const storageData = new Map<string, string>();
const testStorage: Storage = {
  get length() {
    return storageData.size;
  },
  clear: () => storageData.clear(),
  getItem: (key) => storageData.get(key) ?? null,
  key: (index) => [...storageData.keys()][index] ?? null,
  removeItem: (key) => storageData.delete(key),
  setItem: (key, value) => storageData.set(key, String(value)),
};

function ensureStorage(): void {
  try {
    if (window.localStorage) return;
  } catch {
    // JSDOM's opaque origin exposes a throwing localStorage getter.
  }
  Object.defineProperty(window, "localStorage", { configurable: true, value: testStorage });
}

beforeEach(() => {
  ensureStorage();
  window.localStorage.clear();
  resetMonster();
  notice.set(null);
  mode.set("light");
  setPreviewTheme("catppuccin-latte");
  selectedLightTheme.set("catppuccin-latte");
  selectedDarkTheme.set("catppuccin-mocha");
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-mode");
  document.documentElement.removeAttribute("data-theme");
  Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
  vi.restoreAllMocks();
});

describe("monster draft store", () => {
  it("clones replacements and persists a normalized draft", () => {
    const input = createDefaultMonster();
    input.name = "Stored Dragon";

    replaceMonster(input);
    input.name = "Mutated after replacement";

    expect(get(monster).name).toBe("Stored Dragon");
    expect(JSON.parse(window.localStorage.getItem("monster-maker.draft") ?? "{}").name).toBe("Stored Dragon");
  });

  it("advances the replacement epoch only for whole-monster replacements", () => {
    const initialEpoch = get(replacementEpoch);

    monster.update((current) => ({ ...current, name: "Ordinary edit" }));
    expect(get(replacementEpoch)).toBe(initialEpoch);

    replaceMonster(createDefaultMonster());
    expect(get(replacementEpoch)).toBe(initialEpoch + 1);

    resetMonster();
    expect(get(replacementEpoch)).toBe(initialEpoch + 2);

    window.localStorage.setItem("monster-maker.draft", JSON.stringify(createDefaultMonster()));
    restoreMonster();
    expect(get(replacementEpoch)).toBe(initialEpoch + 3);
  });

  it("restores the default monster when storage is malformed", () => {
    window.localStorage.setItem("monster-maker.draft", "not json");
    restoreMonster();
    expect(get(monster)).toEqual(createDefaultMonster());

    window.localStorage.setItem("monster-maker.draft", "[]");
    restoreMonster();
    expect(get(monster)).toEqual(createDefaultMonster());
  });

  it("normalizes and persists direct set and update calls", () => {
    const input = createDefaultMonster();
    input.name = "Direct set";
    monster.set(input);
    expect(get(monster).name).toBe("Direct set");
    expect(JSON.parse(window.localStorage.getItem("monster-maker.draft") ?? "{}").name).toBe("Direct set");

    monster.update((current) => ({ ...current, name: "Direct update" }));
    expect(get(monster).name).toBe("Direct update");
    expect(JSON.parse(window.localStorage.getItem("monster-maker.draft") ?? "{}").name).toBe("Direct update");

    window.localStorage.setItem("monster-maker.draft", JSON.stringify({ name: "Saved draft" }));
    monster.set({ ...createDefaultMonster(), name: "Unsaved memory" });
    window.localStorage.setItem("monster-maker.draft", JSON.stringify({ name: "Saved draft" }));
    restoreMonster();
    expect(get(monster).name).toBe("Saved draft");
    expect(JSON.parse(window.localStorage.getItem("monster-maker.draft") ?? "{}").name).toBe("Saved draft");
  });

  it("does not throw when localStorage writes fail", () => {
    const setItem = vi.fn(() => {
      throw new Error("storage full");
    });
    Object.defineProperty(window, "localStorage", { configurable: true, value: { ...testStorage, setItem } });

    expect(() => replaceMonster({ ...createDefaultMonster(), name: "Memory only" })).not.toThrow();
    expect(get(notice)).toEqual({ kind: "error", message: "Local persistence is unavailable. Your draft remains in memory but may be lost on reload." });
    monster.update((current) => ({ ...current, name: "Still editable" }));
    expect(get(monster).name).toBe("Still editable");
    expect(setItem).toHaveBeenCalledTimes(2);
    expect(get(notice)?.kind).toBe("error");
    Object.defineProperty(window, "localStorage", { configurable: true, value: testStorage });
  });

  it("exposes typed status and error notices", () => {
    notice.set({ kind: "status", message: "Saved" });
    expect(get(notice)).toEqual({ kind: "status", message: "Saved" });
    notice.set({ kind: "error", message: "Import failed" });
    expect(get(notice)?.kind).toBe("error");
  });
});

describe("theme store", () => {
  it("rejects inherited and prototype property names as theme keys", () => {
    expect(isThemeKey("toString")).toBe(false);
    expect(isThemeKey("constructor")).toBe(false);
    expect(isThemeKey("__proto__")).toBe(false);

    window.localStorage.setItem("theme.mode", "dark");
    window.localStorage.setItem("theme.pref", JSON.stringify({ light: "__proto__", dark: "constructor" }));
    initTheme();
    expect(get(selectedLightTheme)).toBe("catppuccin-latte");
    expect(get(selectedDarkTheme)).toBe("catppuccin-mocha");
  });

  it("persists inactive light and dark selections", () => {
    setDarkTheme("dracula");
    setLightTheme("nord-light");
    const preferences = JSON.parse(window.localStorage.getItem("theme.pref") ?? "{}");
    expect(preferences).toEqual({ light: "nord-light", dark: "dracula" });

    selectedLightTheme.set("catppuccin-latte");
    selectedDarkTheme.set("catppuccin-mocha");
    initTheme();
    expect(get(selectedLightTheme)).toBe("nord-light");
    expect(get(selectedDarkTheme)).toBe("dracula");
  });

  it("applies the selected palette and toggles mode", () => {
    setLightTheme("nord-light");
    expect(document.documentElement.dataset).toMatchObject({ mode: "light", theme: "nord-light" });
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(document.documentElement.style.getPropertyValue("--theme-anim-duration")).toBe("180ms");
    expect(document.documentElement.classList.contains("theme-anim")).toBe(true);

    setDarkTheme("dracula");
    toggleMode();
    expect(get(mode)).toBe("dark");
    expect(get(darkTheme)).toBe("dracula");
    expect(document.documentElement.dataset.theme).toBe("dracula");
    expect(window.localStorage.getItem("theme.mode")).toBe("dark");
    expect(JSON.parse(window.localStorage.getItem("theme.pref") ?? "{}").dark).toBe("dracula");
  });

  it("initializes the preview theme from the active site theme", () => {
    selectedLightTheme.set("nord-light");
    mode.set("light");
    initTheme();
    expect(get(previewTheme)).toBe("nord-light");
  });

  it("syncs preview theme when the site theme changes", () => {
    setPreviewTheme("monster-manual-textured");
    setLightTheme("rose-pine-dawn");
    expect(get(previewTheme)).toBe("rose-pine-dawn");

    setPreviewTheme("monster-manual-smooth");
    toggleMode();
    expect(get(previewTheme)).toBe("catppuccin-mocha");
  });

  it("preserves a custom preview theme when changing an inactive site palette", () => {
    setPreviewTheme("monster-manual-smooth");
    setDarkTheme("dracula");
    expect(get(previewTheme)).toBe("monster-manual-smooth");

    toggleMode();
    setPreviewTheme("monster-manual-textured");
    setLightTheme("rose-pine-dawn");
    expect(get(previewTheme)).toBe("monster-manual-textured");
  });

  it("allows preview theme changes without changing site preferences", () => {
    const storedMode = "dark";
    const storedPreferences = '{"light":"nord-light","dark":"dracula"}';
    window.localStorage.setItem("theme.mode", storedMode);
    window.localStorage.setItem("theme.pref", storedPreferences);

    setPreviewTheme("monster-manual-textured");
    expect(get(previewTheme)).toBe("monster-manual-textured");
    expect(window.localStorage.getItem("theme.mode")).toBe(storedMode);
    expect(window.localStorage.getItem("theme.pref")).toBe(storedPreferences);
  });

  it("rejects invalid preview theme keys", () => {
    setPreviewTheme("invalid-preview-key" as never);
    expect(get(previewTheme)).toBe("catppuccin-latte");
  });

  it("uses the system mode only when no valid mode is saved", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }),
    });
    window.localStorage.setItem("theme.mode", "invalid");
    window.localStorage.setItem("theme.pref", "invalid");
    initTheme();
    expect(get(mode)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("catppuccin-mocha");

    window.localStorage.setItem("theme.mode", "light");
    window.localStorage.setItem("theme.pref", "rose-pine");
    initTheme();
    expect(get(mode)).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("catppuccin-latte");
  });

  it("keeps a valid saved mode when matchMedia is unavailable or throws", () => {
    window.localStorage.setItem("theme.mode", "dark");
    Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
    expect(() => initTheme()).not.toThrow();
    expect(get(mode)).toBe("dark");

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => {
        throw new Error("matchMedia unavailable");
      },
    });
    expect(() => initTheme()).not.toThrow();
    expect(get(mode)).toBe("dark");
  });

  it("uses light when storage and matchMedia both fail", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("storage unavailable");
      },
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => {
        throw new Error("matchMedia unavailable");
      },
    });

    expect(() => initTheme()).not.toThrow();
    expect(get(mode)).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("catppuccin-latte");
  });
});
