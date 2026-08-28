import { describe, expect, it } from "vitest";
import { paletteByKey, LIGHT_THEME_KEYS, DARK_THEME_KEYS } from "../../src/lib/theme/palettes";
import { statBlockThemeByKey } from "../../src/lib/theme/stat-block-themes";

describe("theme palette metadata", () => {
  it("matches the reference CSS tokens used by the swatches", () => {
    expect(paletteByKey["catppuccin-mocha"].colors.border).toBe("#45475a");
    expect(paletteByKey["strawberry-light"].colors).toMatchObject({
      background: "#fff1f2",
      surface: "#ffffff",
      foreground: "#111827",
      muted: "#ffe4e6",
      accent: "#f43f5e",
      border: "#fecdd3",
    });
    expect(paletteByKey["gruvbox-light"].colors).toMatchObject({
      background: "#fbf1c7",
      surface: "#ffffff",
      foreground: "#3c3836",
      muted: "#ebdbb2",
      accent: "#d79921",
      border: "#e0cfa9",
    });
    expect(paletteByKey["rose-pine-dawn"].colors).toMatchObject({
      background: "#faf4ed",
      surface: "#ffffff",
      foreground: "#575279",
      muted: "#f2e9e1",
      accent: "#b4637a",
      border: "#dfdad9",
    });
    expect(paletteByKey["strawberry-dark"].colors).toMatchObject({
      background: "#100b1f",
      surface: "#16112b",
      foreground: "#eadeff",
      muted: "#241b3f",
      accent: "#b794f4",
      border: "#2e2454",
    });
  });

  it("maps every site palette to matching stat-block base tokens", () => {
    for (const key of [...LIGHT_THEME_KEYS, ...DARK_THEME_KEYS]) {
      expect(statBlockThemeByKey[key].colors).toMatchObject({
        background: paletteByKey[key].colors.background,
        surface: paletteByKey[key].colors.surface,
        foreground: paletteByKey[key].colors.foreground,
        muted: paletteByKey[key].colors.muted,
        border: paletteByKey[key].colors.border,
        accent: paletteByKey[key].colors.accent,
      });
    }
  });
});
