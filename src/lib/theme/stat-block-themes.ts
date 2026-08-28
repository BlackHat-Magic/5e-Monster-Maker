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
  background: "#f5eddb",
  surface: "#fffaf0",
  foreground: "#2e2118",
  muted: "#eadfca",
  mutedForeground: "#6e5a45",
  border: "#b99f7c",
  accent: "#8b1e1e",
  title: "#8b1e1e",
  rule: "#8b1e1e",
  label: "#8b1e1e",
  emphasis: "#5b4636",
  actionName: "#8b1e1e",
  previewMuted: "#6e5a45",
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
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">' +
  '<filter id="paper-noise"><feTurbulence type="fractalNoise" baseFrequency="0.78" numOctaves="3" seed="17" stitchTiles="stitch"/></filter>' +
  '<rect width="100%" height="100%" fill="#f5eddb" opacity="0.22" filter="url(#paper-noise)"/>' +
  "</svg>";

export function textureDataUri(): string {
  return `data:image/svg+xml,${encodeURIComponent(textureSvg)}`;
}

export function statBlockThemeStyle(key: StatBlockThemeKey): string {
  const { colors, texture } = statBlockThemeByKey[key];
  const declarations = [
    '--font-copy: "Noto Serif", "Merriweather", Georgia, "Times New Roman", serif',
    '--font-display: "Noto Serif", "Merriweather", Georgia, "Times New Roman", serif',
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

  if (texture) declarations.push(`background-image: url("${textureDataUri()}")`);
  return `${declarations.join("; ")};`;
}
