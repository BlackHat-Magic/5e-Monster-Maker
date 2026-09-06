import {
  DARK_THEME_KEYS,
  LIGHT_THEME_KEYS,
  paletteByKey,
  type ThemeKey,
} from "./palettes";

export const MONSTER_MANUAL_THEME_KEYS = [
  "monster-manual-smooth",
  "monster-manual-textured",
] as const;

export type MonsterManualThemeKey = (typeof MONSTER_MANUAL_THEME_KEYS)[number];
export type StatBlockThemeKey = ThemeKey | MonsterManualThemeKey;

export interface StatBlockTheme {
  key: StatBlockThemeKey;
  label: string;
  texture: boolean;
  colors: {
    background: string;
    surface: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
    border: string;
    accent: string;
    title: string;
    rule: string;
    label: string;
    emphasis: string;
    actionName: string;
    previewMuted: string;
  };
}

type PreviewColors = Pick<
  StatBlockTheme["colors"],
  "mutedForeground" | "title" | "rule" | "label" | "emphasis" | "actionName" | "previewMuted"
>;

const sitePreviewColors: Record<ThemeKey, PreviewColors> = {
  "catppuccin-latte": {
    mutedForeground: "#6c6f85",
    title: "#4c4f69",
    rule: "#7287fd",
    label: "#1e66f5",
    emphasis: "#2f7d32",
    actionName: "#179299",
    previewMuted: "#62677a",
  },
  "catppuccin-mocha": {
    mutedForeground: "#bac2de",
    title: "#cdd6f4",
    rule: "#b4befe",
    label: "#74c7ec",
    emphasis: "#a6e3a1",
    actionName: "#94e2d5",
    previewMuted: "#a6adc8",
  },
  "nord-light": {
    mutedForeground: "#4c566a",
    title: "#2e3440",
    rule: "#5e81ac",
    label: "#4c7890",
    emphasis: "#5f7f45",
    actionName: "#3b6ea5",
    previewMuted: "#687386",
  },
  "nord-dark": {
    mutedForeground: "#e5e9f0",
    title: "#d8dee9",
    rule: "#88c0d0",
    label: "#88c0d0",
    emphasis: "#a3be8c",
    actionName: "#8fbcbb",
    previewMuted: "#b8c0ce",
  },
  "gruvbox-light": {
    mutedForeground: "#504945",
    title: "#3c3836",
    rule: "#458588",
    label: "#076678",
    emphasis: "#79740e",
    actionName: "#9d5d00",
    previewMuted: "#665c54",
  },
  "gruvbox-dark": {
    mutedForeground: "#d5c4a1",
    title: "#ebdbb2",
    rule: "#83a598",
    label: "#83a598",
    emphasis: "#b8bb26",
    actionName: "#d3869b",
    previewMuted: "#a89984",
  },
  dracula: {
    mutedForeground: "#bdc0c2",
    title: "#f8f8f2",
    rule: "#8be9fd",
    label: "#8be9fd",
    emphasis: "#50fa7b",
    actionName: "#bd93f9",
    previewMuted: "#bdc0c2",
  },
  "rose-pine-dawn": {
    mutedForeground: "#6e6a86",
    title: "#575279",
    rule: "#56949f",
    label: "#3d7180",
    emphasis: "#3f7d20",
    actionName: "#286983",
    previewMuted: "#6f6b82",
  },
  "rose-pine": {
    mutedForeground: "#c5c3ce",
    title: "#e0def4",
    rule: "#9ccfd8",
    label: "#9ccfd8",
    emphasis: "#7aa65a",
    actionName: "#c4a7e7",
    previewMuted: "#908caa",
  },
  "strawberry-light": {
    mutedForeground: "#374151",
    title: "#111827",
    rule: "#0284c7",
    label: "#0284c7",
    emphasis: "#15803d",
    actionName: "#be185d",
    previewMuted: "#6b7280",
  },
  "strawberry-dark": {
    mutedForeground: "#cdb9ff",
    title: "#eadeff",
    rule: "#67e8f9",
    label: "#67e8f9",
    emphasis: "#86efac",
    actionName: "#f0abfc",
    previewMuted: "#cdb9ff",
  },
};

const monsterManualColors: StatBlockTheme["colors"] = {
  background: "#FDF1DC",
  surface: "#FDF1DC",
  foreground: "#000000",
  muted: "#F5E6C8",
  mutedForeground: "#000000",
  border: "#000000",
  accent: "#922610",
  title: "#922610",
  rule: "#922610",
  label: "#7A200D",
  emphasis: "#000000",
  actionName: "#000000",
  previewMuted: "#922610",
};

const siteTheme = (key: ThemeKey): StatBlockTheme => {
  const palette = paletteByKey[key];
  const preview = sitePreviewColors[key];

  return {
    key,
    label: palette.label,
    texture: false,
    colors: {
      ...palette.colors,
      ...preview,
    },
  };
};

const monsterManualTheme = (
  key: MonsterManualThemeKey,
  texture: boolean,
): StatBlockTheme => ({
  key,
  label: texture ? "Monster Manual (textured)" : "Monster Manual (smooth)",
  texture,
  colors: monsterManualColors,
});

const statBlockThemes: readonly StatBlockTheme[] = [
  ...LIGHT_THEME_KEYS.map(siteTheme),
  ...DARK_THEME_KEYS.map(siteTheme),
  monsterManualTheme(MONSTER_MANUAL_THEME_KEYS[0], false),
  monsterManualTheme(MONSTER_MANUAL_THEME_KEYS[1], true),
];

export const STAT_BLOCK_THEME_KEYS: readonly StatBlockThemeKey[] = statBlockThemes.map(
  ({ key }) => key,
);

const statBlockThemeLookup = Object.create(null) as Record<StatBlockThemeKey, StatBlockTheme>;
for (const theme of statBlockThemes) statBlockThemeLookup[theme.key] = theme;
export const statBlockThemeByKey: Readonly<Record<StatBlockThemeKey, StatBlockTheme>> =
  statBlockThemeLookup;

export function isStatBlockThemeKey(value: unknown): value is StatBlockThemeKey {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(statBlockThemeByKey, value)
  );
}

const textureSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">' +
  '<defs>' +
  '<radialGradient id="paper-wash" cx="48%" cy="42%" r="78%"><stop offset="0" stop-color="#FFF9EC"/><stop offset="0.58" stop-color="#FDF1DC"/><stop offset="1" stop-color="#D0AD72"/></radialGradient>' +
  '<filter id="paper-grain" x="-10%" y="-10%" width="120%" height="120%">' +
  '<feTurbulence type="fractalNoise" baseFrequency="0.018 0.12" numOctaves="5" seed="17" stitchTiles="stitch" result="noise"/>' +
  '<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.52 0 0 0 0 0.37 0 0 0 0 0.18 0 0 0 0.42 0" result="brown-grain"/>' +
  '<feBlend in="SourceGraphic" in2="brown-grain" mode="multiply"/>' +
  '</filter>' +
  '<pattern id="fiber-specks" width="67" height="61" patternUnits="userSpaceOnUse">' +
  '<circle cx="7" cy="11" r="1.4" fill="#8B6B45" opacity="0.2"/><circle cx="28" cy="6" r="0.9" fill="#6F4F2D" opacity="0.16"/>' +
  '<circle cx="48" cy="21" r="1.1" fill="#9A754A" opacity="0.18"/><circle cx="18" cy="38" r="0.8" fill="#6F4F2D" opacity="0.2"/>' +
  '<circle cx="58" cy="49" r="1.5" fill="#8B6B45" opacity="0.14"/><path d="M2 53l15-3M36 34l12-2M49 2l11 4" stroke="#8B6B45" stroke-width="0.8" opacity="0.14"/>' +
  '</pattern>' +
  '</defs>' +
  '<rect width="400" height="400" fill="#FDF1DC"/>' +
  '<rect width="400" height="400" fill="url(#paper-wash)" filter="url(#paper-grain)"/>' +
  '<rect width="400" height="400" fill="url(#fiber-specks)" opacity="0.9"/>' +
  '<path d="M-25 74 C76 34 145 112 254 73 S432 46 426 123 M-40 304 C72 265 152 346 268 304 S433 282 436 360" fill="none" stroke="#8B6B45" stroke-width="4" opacity="0.15"/>' +
  '<path d="M27 -20 C75 67 19 158 58 253 S88 390 39 425 M362 -25 C307 67 382 146 343 240 S315 373 370 426" fill="none" stroke="#6F4F2D" stroke-width="3" opacity="0.12"/>' +
  '<path d="M-18 180 C80 153 133 191 218 166 S359 144 420 183 M-20 225 C72 202 140 240 226 215 S352 201 420 228" fill="none" stroke="#B08A5A" stroke-width="2" opacity="0.09"/>' +
  '</svg>';

const barSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="5" viewBox="0 0 400 5">' +
  '<defs><filter id="bar-noise"><feTurbulence type="fractalNoise" baseFrequency="0.04 0.8" numOctaves="2" seed="23" stitchTiles="stitch"/></filter></defs>' +
  '<rect width="400" height="5" fill="#E69A28"/>' +
  '<rect width="400" height="5" fill="#7A200D" opacity="0.22" filter="url(#bar-noise)"/>' +
  '</svg>';

// Parchment texture, AVIF-first with a JPEG fallback in a single
// declaration. image-set() lets the browser pick a format it can decode;
// environments without image-set() ignore the declaration and keep the flat
// card background underneath.
const parchmentImageSet =
  'image-set(url("/statblockparch.avif") type("image/avif"), url("/statblockparch.jpg") type("image/jpeg"))';

export function textureDataUri(): string {
  return `data:image/svg+xml,${encodeURIComponent(textureSvg)}`;
}

function barDataUri(): string {
  return `data:image/svg+xml,${encodeURIComponent(barSvg)}`;
}

export function statBlockThemeStyle(key: StatBlockThemeKey): string {
  const { colors, texture } = statBlockThemeByKey[key];
  const isMonsterManual = key === "monster-manual-smooth" || key === "monster-manual-textured";
  const declarations = [
    isMonsterManual
      ? '--font-copy: "Noto Sans", "Myriad Pro", Calibri, Helvetica, Arial, sans-serif'
      : '--font-copy: "Noto Serif", "Merriweather", Georgia, "Times New Roman", serif',
    isMonsterManual
      ? '--font-display: "Libre Baskerville", "Lora", "Calisto MT", "Bookman Old Style", Bookman, Georgia, serif'
      : '--font-display: "Noto Serif", "Merriweather", Georgia, "Times New Roman", serif',
    `--bg: ${colors.background}`,
    `--card: ${colors.surface}`,
    `--foreground: ${colors.foreground}`,
    `--muted: ${colors.muted}`,
    `--muted-foreground: ${colors.mutedForeground}`,
    `--border: ${colors.border}`,
    `--accent: ${colors.accent}`,
    `--ring: ${colors.accent}`,
    `--preview-title: ${colors.title}`,
    `--preview-rule: ${colors.rule}`,
    `--preview-label: ${colors.label}`,
    `--preview-emphasis: ${colors.emphasis}`,
    `--preview-action-name: ${colors.actionName}`,
    `--preview-muted: ${colors.previewMuted}`,
    "--code-background: color-mix(in srgb, var(--muted) 72%, var(--card))",
    "--quote-background: color-mix(in srgb, var(--accent) 7%, var(--card))",
    "--quote-border: var(--accent)",
  ];

  if (isMonsterManual) {
    declarations.push(
      `--stat-block-bar: ${texture ? `url("/statblockbar.jpg"), url("${barDataUri()}")` : "linear-gradient(#E69A28, #E69A28)"}`,
    );
  }
  if (texture) {
    declarations.push(`background-image: ${parchmentImageSet}, url("${textureDataUri()}")`);
  }
  return `${declarations.join("; ")};`;
}
