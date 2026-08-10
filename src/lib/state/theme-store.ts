import { get, writable, type Writable } from "svelte/store";
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_MODE,
  isThemeKey,
  paletteByKey,
  type DarkThemeKey,
  type LightThemeKey,
  type ThemeKey,
  type ThemeMode,
} from "../theme/palettes";
import { notice, reportPersistenceFailure } from "./monster-store";

const PREF_KEY = "theme.pref";
const MODE_KEY = "theme.mode";
const THEME_ANIM_DURATION = "180ms";
type StoredPreferences = { light: LightThemeKey; dark: DarkThemeKey };

export const mode: Writable<ThemeMode> = writable(DEFAULT_MODE);
export const selectedLightTheme: Writable<LightThemeKey> = writable(DEFAULT_LIGHT_THEME);
export const selectedDarkTheme: Writable<DarkThemeKey> = writable(DEFAULT_DARK_THEME);

// Short aliases keep component usage natural while the selected names document the values.
export const lightTheme = selectedLightTheme;
export const darkTheme = selectedDarkTheme;

let transitionTimer: ReturnType<typeof setTimeout> | undefined;

function canUseBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

function activeThemeKey(themeMode: ThemeMode): ThemeKey {
  return themeMode === "light" ? get(selectedLightTheme) : get(selectedDarkTheme);
}

function storageValue(key: string): string | null {
  if (!canUseBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveTheme(modeValue: ThemeMode): void {
  if (!canUseBrowser()) return;
  try {
    window.localStorage.setItem(MODE_KEY, modeValue);
    const preferences: StoredPreferences = {
      light: get(selectedLightTheme),
      dark: get(selectedDarkTheme),
    };
    window.localStorage.setItem(PREF_KEY, JSON.stringify(preferences));
  } catch {
    reportPersistenceFailure();
  }
}

function systemMode(): ThemeMode {
  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(nextMode: ThemeMode = get(mode), nextKey?: ThemeKey): void {
  if (!isThemeMode(nextMode)) return;

  const requestedKey = nextKey ?? activeThemeKey(nextMode);
  const key = isThemeKey(requestedKey) && paletteByKey[requestedKey].mode === nextMode
    ? requestedKey
    : activeThemeKey(nextMode);

  if (!canUseBrowser()) return;
  const root = document.documentElement;
  root.dataset.mode = nextMode;
  root.dataset.theme = key;
  root.style.colorScheme = nextMode;
  root.style.setProperty("--theme-anim-duration", THEME_ANIM_DURATION);
  root.classList.add("theme-anim");

  if (transitionTimer !== undefined) window.clearTimeout(transitionTimer);
  transitionTimer = window.setTimeout(() => root.classList.remove("theme-anim"), 180);
}

export function toggleMode(): void {
  const nextMode: ThemeMode = get(mode) === "light" ? "dark" : "light";
  mode.set(nextMode);
  const key = activeThemeKey(nextMode);
  saveTheme(nextMode);
  applyTheme(nextMode, key);
}

export function setLightTheme(key: LightThemeKey): void {
  if (!isThemeKey(key) || paletteByKey[key].mode !== "light") return;
  selectedLightTheme.set(key);
  saveTheme(get(mode));
  if (get(mode) === "light") applyTheme("light", key);
}

export function setDarkTheme(key: DarkThemeKey): void {
  if (!isThemeKey(key) || paletteByKey[key].mode !== "dark") return;
  selectedDarkTheme.set(key);
  saveTheme(get(mode));
  if (get(mode) === "dark") applyTheme("dark", key);
}

export function initTheme(): void {
  const savedMode = storageValue(MODE_KEY);
  const nextMode = isThemeMode(savedMode) ? savedMode : canUseBrowser() ? systemMode() : DEFAULT_MODE;
  const savedPreference = storageValue(PREF_KEY);

  if (savedPreference) {
    try {
      const parsed: unknown = JSON.parse(savedPreference);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const preferences = parsed as Record<string, unknown>;
        const light = preferences.light;
        const dark = preferences.dark;
        if (isThemeKey(light) && paletteByKey[light].mode === "light") selectedLightTheme.set(light as LightThemeKey);
        if (isThemeKey(dark) && paletteByKey[dark].mode === "dark") selectedDarkTheme.set(dark as DarkThemeKey);
      } else if (isThemeKey(parsed)) {
        if (paletteByKey[parsed].mode === "light") selectedLightTheme.set(parsed as LightThemeKey);
        else selectedDarkTheme.set(parsed as DarkThemeKey);
      }
    } catch {
      // Invalid stored preferences leave the safe defaults in place.
    }
  }

  mode.set(nextMode);
  applyTheme(nextMode, activeThemeKey(nextMode));
}
