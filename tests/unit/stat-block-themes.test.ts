import { describe, expect, it } from "vitest";
import {
  MONSTER_MANUAL_THEME_KEYS,
  STAT_BLOCK_THEME_KEYS,
  isStatBlockThemeKey,
  statBlockThemeByKey,
  statBlockThemeStyle,
  textureDataUri,
  type StatBlockTheme,
} from "../../src/lib/theme/stat-block-themes";

const expectedSitePreviewColors: Record<string, Pick<StatBlockTheme["colors"], "mutedForeground" | "title" | "rule" | "label" | "emphasis" | "actionName" | "previewMuted">> = {
  "catppuccin-latte": { mutedForeground: "#6c6f85", title: "#4c4f69", rule: "#7287fd", label: "#1e66f5", emphasis: "#2f7d32", actionName: "#179299", previewMuted: "#62677a" },
  "catppuccin-mocha": { mutedForeground: "#bac2de", title: "#cdd6f4", rule: "#b4befe", label: "#74c7ec", emphasis: "#a6e3a1", actionName: "#94e2d5", previewMuted: "#a6adc8" },
  "nord-light": { mutedForeground: "#4c566a", title: "#2e3440", rule: "#5e81ac", label: "#4c7890", emphasis: "#5f7f45", actionName: "#3b6ea5", previewMuted: "#687386" },
  "nord-dark": { mutedForeground: "#e5e9f0", title: "#d8dee9", rule: "#88c0d0", label: "#88c0d0", emphasis: "#a3be8c", actionName: "#8fbcbb", previewMuted: "#b8c0ce" },
  "gruvbox-light": { mutedForeground: "#504945", title: "#3c3836", rule: "#458588", label: "#076678", emphasis: "#79740e", actionName: "#9d5d00", previewMuted: "#665c54" },
  "gruvbox-dark": { mutedForeground: "#d5c4a1", title: "#ebdbb2", rule: "#83a598", label: "#83a598", emphasis: "#b8bb26", actionName: "#d3869b", previewMuted: "#a89984" },
  dracula: { mutedForeground: "#bdc0c2", title: "#f8f8f2", rule: "#8be9fd", label: "#8be9fd", emphasis: "#50fa7b", actionName: "#bd93f9", previewMuted: "#bdc0c2" },
  "rose-pine-dawn": { mutedForeground: "#6e6a86", title: "#575279", rule: "#56949f", label: "#3d7180", emphasis: "#3f7d20", actionName: "#286983", previewMuted: "#6f6b82" },
  "rose-pine": { mutedForeground: "#c5c3ce", title: "#e0def4", rule: "#9ccfd8", label: "#9ccfd8", emphasis: "#7aa65a", actionName: "#c4a7e7", previewMuted: "#908caa" },
  "strawberry-light": { mutedForeground: "#374151", title: "#111827", rule: "#0284c7", label: "#0284c7", emphasis: "#15803d", actionName: "#be185d", previewMuted: "#6b7280" },
  "strawberry-dark": { mutedForeground: "#cdb9ff", title: "#eadeff", rule: "#67e8f9", label: "#67e8f9", emphasis: "#86efac", actionName: "#f0abfc", previewMuted: "#cdb9ff" },
};

describe("stat-block themes", () => {
  it("includes existing palettes and both Monster Manual variants", () => {
    expect(STAT_BLOCK_THEME_KEYS).toContain("catppuccin-latte");
    expect(MONSTER_MANUAL_THEME_KEYS).toEqual([
      "monster-manual-smooth",
      "monster-manual-textured",
    ]);
    expect(statBlockThemeByKey["monster-manual-smooth"]).toMatchObject({
      label: "Monster Manual (smooth)",
      texture: false,
    });
    expect(statBlockThemeByKey["monster-manual-textured"]).toMatchObject({
      label: "Monster Manual (textured)",
      texture: true,
    });
  });

  it("uses the classic cream and red tokens for both Monster Manual variants", () => {
    const smooth = statBlockThemeByKey["monster-manual-smooth"];
    const textured = statBlockThemeByKey["monster-manual-textured"];
    expect(smooth.colors.background).toBe(textured.colors.background);
    expect(smooth.colors.accent).toBe(textured.colors.accent);
    expect(smooth.colors.background).toBe("#FDF1DC");
    expect(smooth.colors.title).toBe("#922610");
    expect(smooth.colors.label).toBe("#7A200D");
    expect(smooth.colors.background).toMatch(/^#/);
    expect(smooth.colors.accent).toMatch(/^#/);
  });

  it("generates deterministic embedded texture data", () => {
    const dataUri = textureDataUri();
    const prefix = "data:image/svg+xml,";
    const svg = decodeURIComponent(dataUri.slice(prefix.length));

    expect(dataUri).toBe(textureDataUri());
    expect(dataUri).toMatch(/^data:image\/svg\+xml,/);
    expect(dataUri).not.toContain("<svg");
    expect(svg).toMatch(/^<svg[\s>]/);
    expect(svg).toContain("<feTurbulence");
    expect(svg).toContain('seed="17"');
    expect(svg).toContain('fill="#FDF1DC"');
    expect(svg).toContain('id="paper-wash"');
    expect(new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("parsererror")).toBeNull();
    expect(statBlockThemeStyle("monster-manual-textured")).toContain("background-image");
    expect(statBlockThemeStyle("monster-manual-textured")).toContain('url("/statblockparch.jpg")');
    expect(statBlockThemeStyle("monster-manual-smooth")).not.toContain("background-image");
    expect(statBlockThemeStyle("monster-manual-textured")).toContain("--font-copy: \"Noto Sans\"");
    expect(statBlockThemeStyle("monster-manual-textured")).toContain("--font-display: \"Libre Baskerville\"");
    expect(statBlockThemeStyle("monster-manual-textured")).toContain('--stat-block-bar: url("/statblockbar.jpg")');
  });

  it("serializes exact CSS declarations for every stat-block theme", () => {
    for (const key of STAT_BLOCK_THEME_KEYS) {
      const { colors } = statBlockThemeByKey[key];
      const style = statBlockThemeStyle(key);
      const expectedDeclarations = {
        "--bg": colors.background,
        "--card": colors.surface,
        "--foreground": colors.foreground,
        "--muted": colors.muted,
        "--muted-foreground": colors.mutedForeground,
        "--border": colors.border,
        "--accent": colors.accent,
        "--ring": colors.accent,
        "--preview-title": colors.title,
        "--preview-rule": colors.rule,
        "--preview-label": colors.label,
        "--preview-emphasis": colors.emphasis,
        "--preview-action-name": colors.actionName,
        "--preview-muted": colors.previewMuted,
        "--code-background": "color-mix(in srgb, var(--muted) 72%, var(--card))",
        "--quote-background": "color-mix(in srgb, var(--accent) 7%, var(--card))",
        "--quote-border": "var(--accent)",
      };

      for (const [variable, value] of Object.entries(expectedDeclarations)) {
        expect(style).toContain(`${variable}: ${value}`);
      }
    }
  });

  it("preserves the original site palette preview-role colors", () => {
    for (const [key, colors] of Object.entries(expectedSitePreviewColors)) {
      expect(statBlockThemeByKey[key as keyof typeof statBlockThemeByKey].colors).toMatchObject(colors);
    }
  });

  it("rejects invalid and prototype values as stat-block theme keys", () => {
    expect(isStatBlockThemeKey("catppuccin-latte")).toBe(true);
    expect(isStatBlockThemeKey(undefined)).toBe(false);
    expect(isStatBlockThemeKey(null)).toBe(false);
    expect(isStatBlockThemeKey(42)).toBe(false);
    expect(isStatBlockThemeKey({})).toBe(false);
    expect(isStatBlockThemeKey("toString")).toBe(false);
    expect(isStatBlockThemeKey("constructor")).toBe(false);
    expect(isStatBlockThemeKey("__proto__")).toBe(false);
  });
});
