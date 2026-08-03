export type ThemeMode = "light" | "dark";

export const LIGHT_THEME_KEYS = [
  "catppuccin-latte",
  "nord-light",
  "strawberry-light",
  "gruvbox-light",
  "rose-pine-dawn",
] as const;

export const DARK_THEME_KEYS = [
  "catppuccin-mocha",
  "nord-dark",
  "strawberry-dark",
  "gruvbox-dark",
  "dracula",
  "rose-pine",
] as const;

export type LightThemeKey = (typeof LIGHT_THEME_KEYS)[number];
export type DarkThemeKey = (typeof DARK_THEME_KEYS)[number];
export type ThemeKey = LightThemeKey | DarkThemeKey;

export interface ThemePalette {
  key: ThemeKey;
  label: string;
  mode: ThemeMode;
  colors: {
    background: string;
    surface: string;
    foreground: string;
    muted: string;
    accent: string;
    border: string;
  };
}

const palette = (
  key: ThemeKey,
  label: string,
  mode: ThemeMode,
  colors: ThemePalette["colors"],
): ThemePalette => ({ key, label, mode, colors });

export const lightPalettes: readonly ThemePalette[] = [
  palette("catppuccin-latte", "Catppuccin Latte", "light", {
    background: "#eff1f5",
    surface: "#ffffff",
    foreground: "#4c4f69",
    muted: "#e6e9ef",
    accent: "#1e66f5",
    border: "#ccd0da",
  }),
  palette("nord-light", "Nord Light", "light", {
    background: "#eceff4",
    surface: "#ffffff",
    foreground: "#2e3440",
    muted: "#e5e9f0",
    accent: "#5e81ac",
    border: "#d8dee9",
  }),
  palette("strawberry-light", "Strawberry Light", "light", {
    background: "#fff1f2",
    surface: "#ffffff",
    foreground: "#111827",
    muted: "#ffe4e6",
    accent: "#f43f5e",
    border: "#fecdd3",
  }),
  palette("gruvbox-light", "Gruvbox Light", "light", {
    background: "#fbf1c7",
    surface: "#ffffff",
    foreground: "#3c3836",
    muted: "#ebdbb2",
    accent: "#d79921",
    border: "#e0cfa9",
  }),
  palette("rose-pine-dawn", "Rosé Pine Dawn", "light", {
    background: "#faf4ed",
    surface: "#ffffff",
    foreground: "#575279",
    muted: "#f2e9e1",
    accent: "#b4637a",
    border: "#dfdad9",
  }),
] as const;

export const darkPalettes: readonly ThemePalette[] = [
  palette("catppuccin-mocha", "Catppuccin Mocha", "dark", {
    background: "#1e1e2e",
    surface: "#181825",
    foreground: "#cdd6f4",
    muted: "#313244",
    accent: "#89b4fa",
    border: "#45475a",
  }),
  palette("nord-dark", "Nord Dark", "dark", {
    background: "#2e3440",
    surface: "#3b4252",
    foreground: "#d8dee9",
    muted: "#434c5e",
    accent: "#88c0d0",
    border: "#4c566a",
  }),
  palette("strawberry-dark", "Strawberry Dark", "dark", {
    background: "#100b1f",
    surface: "#16112b",
    foreground: "#eadeff",
    muted: "#241b3f",
    accent: "#b794f4",
    border: "#2e2454",
  }),
  palette("gruvbox-dark", "Gruvbox Dark", "dark", {
    background: "#282828",
    surface: "#1d2021",
    foreground: "#ebdbb2",
    muted: "#3c3836",
    accent: "#fabd2f",
    border: "#3c3836",
  }),
  palette("dracula", "Dracula", "dark", {
    background: "#282a36",
    surface: "#1e1f29",
    foreground: "#f8f8f2",
    muted: "#44475a",
    accent: "#bd93f9",
    border: "#44475a",
  }),
  palette("rose-pine", "Rosé Pine", "dark", {
    background: "#191724",
    surface: "#1f1d2e",
    foreground: "#e0def4",
    muted: "#26233a",
    accent: "#c4a7e7",
    border: "#2a2837",
  }),
] as const;

export const palettes = { light: lightPalettes, dark: darkPalettes } as const;

const paletteLookup = Object.create(null) as Record<ThemeKey, ThemePalette>;
for (const entry of [...lightPalettes, ...darkPalettes]) paletteLookup[entry.key] = entry;
export const paletteByKey: Readonly<Record<ThemeKey, ThemePalette>> = paletteLookup;

export const DEFAULT_MODE: ThemeMode = "light";
export const DEFAULT_LIGHT_THEME: LightThemeKey = "catppuccin-latte";
export const DEFAULT_DARK_THEME: DarkThemeKey = "catppuccin-mocha";

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(paletteByKey, value);
}

export function paletteForKey(key: ThemeKey): ThemePalette {
  return paletteByKey[key];
}
