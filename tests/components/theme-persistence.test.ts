// @vitest-environment jsdom

import { flushSync, mount, unmount } from "svelte";
import { get } from "svelte/store";
import { afterEach, describe, expect, it, vi } from "vitest";
import ToastHost from "../../src/lib/components/app-shell/ToastHost.svelte";
import { selectedLightTheme, setLightTheme } from "../../src/lib/state/theme-store";
import { notice } from "../../src/lib/state/monster-store";

const storage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(() => undefined),
};

afterEach(() => {
  document.body.replaceChildren();
  notice.set(null);
  storage.getItem.mockReset().mockReturnValue(null);
  storage.setItem.mockReset().mockReturnValue(undefined);
  vi.restoreAllMocks();
});

describe("theme persistence failures", () => {
  it("shows the persistence warning while keeping theme changes in memory", () => {
    const component = mount(ToastHost, { target: document.body });
    const setItem = vi.fn(() => {
      throw new Error("storage unavailable");
    });
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { ...storage, setItem },
    });

    setLightTheme("nord-light");
    flushSync();

    expect(get(selectedLightTheme)).toBe("nord-light");
    expect(document.querySelector('[data-testid="toast-notice"]')?.textContent).toContain("Local persistence is unavailable");
    expect(document.documentElement.dataset.theme).toBe("nord-light");

    notice.set({ kind: "status", message: "Theme changed." });
    setLightTheme("catppuccin-latte");
    flushSync();
    expect(document.querySelector('[data-testid="toast-notice"]')?.textContent).toContain("Theme changed.");

    unmount(component);
  });
});
