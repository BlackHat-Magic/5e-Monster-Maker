import { describe, expect, it } from "vitest";
import { paletteByKey } from "../../src/lib/theme/palettes";

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
});
