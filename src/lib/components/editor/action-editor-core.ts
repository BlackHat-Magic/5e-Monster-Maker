import type { ActionItem, AbilityKey, Monster, PresetName } from "$lib/monster/types";
import {
  normalizeInnateSpellGroups,
  normalizeSpellcastingSpells,
  serializeInnateSpellGroups,
  serializeSpellcastingSpells,
  type InnateSpellGroupDraft,
  type SpellcastingDraft,
} from "$lib/monster/spells";

export {
  collectSpellWarnings,
  normalizeInnateSpellGroups,
  normalizeSpellcastingSpells,
  serializeInnateSpellGroups,
  serializeSpellcastingSpells,
} from "$lib/monster/spells";
export type { InnateSpellGroupDraft, SpellcastingDraft } from "$lib/monster/spells";

export const ACTION_ARRAY_KEYS = [
  "ability",
  "action",
  "bonus_action",
  "reaction",
  "legendary_action",
  "villain_action",
  "mythic_action",
] as const;

export type ActionArrayKey = (typeof ACTION_ARRAY_KEYS)[number];
export type IntroDescriptionKey = "legendary_description" | "villain_description" | "mythic_description";

export const PRESET_OPTIONS: ReadonlyArray<{ value: PresetName; label: string }> = [
  { value: "none", label: "None / custom" },
  { value: "attack", label: "Weapon attack" },
  { value: "legendary_resistance", label: "Legendary resistance" },
  { value: "spellcasting", label: "Spellcasting" },
  { value: "innate_spellcasting", label: "Innate spellcasting" },
];

export const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export type TokenCategory =
  | "names"
  | "ability-modifiers"
  | "ability-attacks"
  | "ability-saves"
  | "bare-dice"
  | "ability-damage"
  | "numeric-modifiers";

export type TokenOption = {
  token: string;
  label: string;
};

export type TokenPickerKeyAction = {
  activeIndex: number;
  action: "none" | "close" | "choose";
  handled: boolean;
};

export type TokenGroup = {
  id: TokenCategory;
  label: string;
  options: readonly TokenOption[];
};

const dice = ["1D4", "1D6", "1D8", "1D10", "1D12", "2D6", "2D8", "3D6"] as const;
const numericModifiers = [-3, -2, -1, 1, 2, 3].flatMap((modifier) =>
  ABILITY_KEYS.flatMap((ability) => [
    { token: `${ability.toUpperCase()} ATK ${modifier > 0 ? "+" : ""}${modifier}`, label: `${ability.toUpperCase()} ATK ${modifier > 0 ? "+" : ""}${modifier}` },
    { token: `${ability.toUpperCase()} SAVE ${modifier > 0 ? "+" : ""}${modifier}`, label: `${ability.toUpperCase()} SAVE ${modifier > 0 ? "+" : ""}${modifier}` },
  ]),
);

function withNumericModifiers(token: string, label: string): TokenOption[] {
  return [
    { token, label },
    ...[-3, -2, -1, 1, 2, 3].map((modifier) => {
      const sign = modifier > 0 ? "+" : "-";
      return { token: `${token} ${sign} ${Math.abs(modifier)}`, label: `${label} ${sign} ${Math.abs(modifier)}` };
    }),
  ];
}

export const TOKEN_GROUPS: readonly TokenGroup[] = [
  {
    id: "names",
    label: "Creature names",
    options: [
      { token: "MON", label: "MON - creature name" },
      { token: "MONS", label: "MONS - plural name" },
    ],
  },
  {
    id: "ability-modifiers",
    label: "Ability modifiers",
    options: ABILITY_KEYS.map((ability) => ({ token: ability.toUpperCase(), label: `${ability.toUpperCase()} modifier` })),
  },
  {
    id: "ability-attacks",
    label: "Ability attacks",
    options: ABILITY_KEYS.map((ability) => ({ token: `${ability.toUpperCase()} ATK`, label: `${ability.toUpperCase()} attack bonus` })),
  },
  {
    id: "ability-saves",
    label: "Ability saves",
    options: ABILITY_KEYS.map((ability) => ({ token: `${ability.toUpperCase()} SAVE`, label: `${ability.toUpperCase()} save DC` })),
  },
  {
    id: "bare-dice",
    label: "Bare dice",
    options: dice.flatMap((token) => withNumericModifiers(token, token)),
  },
  {
    id: "ability-damage",
    label: "Ability damage",
    options: ABILITY_KEYS.flatMap((ability) => dice.flatMap((die) => {
      const token = `${ability.toUpperCase()} ${die}`;
      return withNumericModifiers(token, `${token} damage`);
    })),
  },
  {
    id: "numeric-modifiers",
    label: "Numeric +/- modifiers",
    options: numericModifiers,
  },
];

export function createDefaultAction(): ActionItem {
  return { name: "", preset: "none", description: "" };
}

function emptySpellcastingDraft(): SpellcastingDraft {
  return normalizeSpellcastingSpells([]);
}

export function switchActionPreset(item: ActionItem, preset: PresetName): ActionItem {
	const { spells: _spells, ...common } = item;
	const sourceSchema = spellSchema(item.preset);
	const targetSchema = spellSchema(preset);
	if (targetSchema === "spellcasting") {
		const spells = sourceSchema === targetSchema
			? serializeSpellcastingSpells(normalizeSpellcastingSpells(item.spells))
			: serializeSpellcastingSpells(emptySpellcastingDraft());
		return { ...common, preset, spells };
	}
	if (targetSchema === "innate") {
		const spells = sourceSchema === targetSchema
			? serializeInnateSpellGroups(normalizeInnateSpellGroups(item.spells))
			: serializeInnateSpellGroups([]);
		return { ...common, preset, spells };
	}
	return { ...common, preset };
}

function spellSchema(preset: PresetName | undefined): "spellcasting" | "innate" | null {
	if (preset === "spellcasting") return "spellcasting";
	if (preset === "innate_spellcasting") return "innate";
	return null;
}

export function presetFieldGroup(preset: PresetName): "attack" | "spellcasting" | "innate_spellcasting" | null {
  return preset === "attack" || preset === "spellcasting" || preset === "innate_spellcasting" ? preset : null;
}

export function updateIntroDescription(monster: Monster, key: IntroDescriptionKey, value: string): Monster {
  return { ...monster, [key]: value };
}

export function updateActionArray(monster: Monster, key: ActionArrayKey, items: readonly ActionItem[]): Monster {
  return { ...monster, [key]: items.map((item) => ({ ...item })) };
}

export function updateActionItem(monster: Monster, key: ActionArrayKey, index: number, item: ActionItem): Monster {
  const items = [...(monster[key] ?? [])];
  if (index < 0 || index >= items.length) return { ...monster, [key]: items };
  items[index] = { ...item };
  return updateActionArray(monster, key, items);
}

export function parseNonNegativeInteger(raw: string): number | null {
	return parseIntegerAtLeast(raw, 0);
}

export function parsePositiveInteger(raw: string): number | null {
	return parseIntegerAtLeast(raw, 1);
}

export function parseIntegerAtLeast(raw: string, minimum: number): number | null {
	const value = raw.trim();
	if (!value || !/^-?\d+$/.test(value)) return null;
	const number = Number(value);
	return Number.isSafeInteger(number) && number >= minimum ? number : null;
}

export function parseNumberOrString(raw: string): number | string {
	const value = raw.trim();
	if (!value) return "";
	const number = Number(value);
	return Number.isFinite(number) && (!Number.isInteger(number) || Number.isSafeInteger(number)) ? number : raw;
}

export function innateGroupLabel(frequency: number): string {
  return String(frequency) === "-1" ? "At will" : `${String(frequency || 0)}/day each`;
}

export function tokenText(token: string): string {
  return `{{${token}}}`;
}

export function tokenPickerKeyAction(key: string, activeIndex: number, optionCount: number): TokenPickerKeyAction {
  if (optionCount <= 0) return { activeIndex: 0, action: "none", handled: false };
  if (key === "Escape") return { activeIndex, action: "close", handled: true };
  if (key === "Enter" || key === " ") return { activeIndex, action: "choose", handled: true };
  if (key === "Home") return { activeIndex: 0, action: "none", handled: true };
  if (key === "End") return { activeIndex: optionCount - 1, action: "none", handled: true };
  if (key === "ArrowDown" || key === "ArrowRight") {
    return { activeIndex: (activeIndex + 1 + optionCount) % optionCount, action: "none", handled: true };
  }
  if (key === "ArrowUp" || key === "ArrowLeft") {
    return { activeIndex: (activeIndex - 1 + optionCount) % optionCount, action: "none", handled: true };
  }
  return { activeIndex, action: "none", handled: false };
}

export function insertTokenAtSelection(source: string, start: number, end: number, token: string): { value: string; caret: number } {
  const safeStart = Math.max(0, Math.min(start, source.length));
  const safeEnd = Math.max(safeStart, Math.min(end, source.length));
  const inserted = tokenText(token);
  const value = `${source.slice(0, safeStart)}${inserted}${source.slice(safeEnd)}`;
  return { value, caret: safeStart + inserted.length };
}
