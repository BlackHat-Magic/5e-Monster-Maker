import type { AbilityKey, EditorSection, LanguageEntry, Monster } from "$lib/monster/types";
import type { ActionArrayKey } from "./action-editor-core";

export const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
export const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export type EditorSectionMeta = {
  key: EditorSection;
  label: string;
  group: "Build" | "Combat";
  editor: "identity" | "features" | "basics" | "stats" | "proficiencies" | "languages" | "actions";
  actionTarget?: ActionArrayKey;
};

export const EDITOR_SECTIONS: readonly EditorSectionMeta[] = [
  { key: "identity", label: "Identity", group: "Build", editor: "identity" },
  { key: "features", label: "Features", group: "Build", editor: "features" },
  { key: "basics", label: "Basics", group: "Build", editor: "basics" },
  { key: "stats", label: "Core Stats", group: "Build", editor: "stats" },
  { key: "proficiencies", label: "Proficiencies", group: "Build", editor: "proficiencies" },
  { key: "language", label: "Languages", group: "Build", editor: "languages" },
  { key: "traits", label: "Traits", group: "Combat", editor: "actions", actionTarget: "ability" },
  { key: "action", label: "Actions", group: "Combat", editor: "actions", actionTarget: "action" },
  { key: "bonus_action", label: "Bonus Actions", group: "Combat", editor: "actions", actionTarget: "bonus_action" },
  { key: "reaction", label: "Reactions", group: "Combat", editor: "actions", actionTarget: "reaction" },
  { key: "legendary_action", label: "Legendary", group: "Combat", editor: "actions", actionTarget: "legendary_action" },
  { key: "villain_action", label: "Villain", group: "Combat", editor: "actions", actionTarget: "villain_action" },
  { key: "mythic_action", label: "Mythic", group: "Combat", editor: "actions", actionTarget: "mythic_action" },
];

export function editorSectionLabel(section: EditorSection): string {
  return EDITOR_SECTIONS.find((entry) => entry.key === section)?.label ?? section;
}

export function editorTabId(section: EditorSection): string {
  return `section-tab-${section}`;
}

export const EDITOR_PANEL_ID = "editor-panel";

export function editorPanelId(section?: EditorSection): string {
	return section ? `${EDITOR_PANEL_ID}-${section}` : EDITOR_PANEL_ID;
}

export type NumericDraftField =
  | "base_ac"
  | "max_dex"
  | "hit_dice"
  | `speed.${"walk" | "burrow" | "climb" | "fly" | "swim"}`
  | `ability.${AbilityKey}`;

export type NumericDraftResult =
  | { valid: true; value: number }
  | { valid: false; error: string };

export function validateNumericDraft(field: NumericDraftField, raw: string): NumericDraftResult {
  const value = raw.trim();
  if (value === "") return { valid: false, error: "Enter a value." };
  if (!/^-?\d+$/.test(value)) return { valid: false, error: "Use a whole number." };

  const number = Number(value);
  if (!Number.isSafeInteger(number)) return { valid: false, error: "Use a smaller whole number." };
  if (field === "max_dex") {
    if (number < -1) return { valid: false, error: "Max Dex must be -1 or greater." };
  } else if (number < 0) {
    return { valid: false, error: "Use zero or a positive whole number." };
  }
  return { valid: true, value: number };
}

export function shouldResyncNumericDraft(
  previousExternalValue: number | undefined,
  currentExternalValue: number,
  dirty: boolean,
  focused: boolean,
): boolean {
  return previousExternalValue === undefined || previousExternalValue !== currentExternalValue || (!dirty && !focused);
}

export function shouldResyncStringDraft(
  previousExternalValue: string | undefined,
  currentExternalValue: string,
  dirty: boolean,
  focused: boolean,
): boolean {
  return previousExternalValue === undefined || previousExternalValue !== currentExternalValue || (!dirty && !focused);
}

export type SenseDraftResult =
  | { valid: true; value: number }
  | { valid: false; error: string };

export function validateSenseDraft(raw: string): SenseDraftResult {
  const value = raw.trim();
  if (value === "") return { valid: false, error: "Enter a value." };
  if (!/^\d+$/.test(value)) return { valid: false, error: "Use zero or a positive whole number." };

  const number = Number(value);
  if (!Number.isSafeInteger(number)) return { valid: false, error: "Use a smaller whole number." };
  return { valid: true, value: number };
}

export function repeatablePrimitiveKey(index: number): string {
	return `primitive-${index}`;
}

export type RepeatableKeyState = {
	keys: string[];
	next: number;
};

export function createRepeatableKeyState(length: number): RepeatableKeyState {
	return {
		keys: Array.from({ length: Math.max(0, length) }, (_, index) => `row-${index}`),
		next: Math.max(0, length),
	};
}

export function syncRepeatableKeys(state: RepeatableKeyState, length: number): void {
	const targetLength = Math.max(0, length);
	if (state.keys.length > targetLength) state.keys = state.keys.slice(0, targetLength);
	while (state.keys.length < targetLength) appendRepeatableKey(state);
}

export function appendRepeatableKey(state: RepeatableKeyState): string {
	let key = `row-${state.next++}`;
	while (state.keys.includes(key)) key = `row-${state.next++}`;
	state.keys.push(key);
	return key;
}

export type RepeatableFocusTarget =
	| { kind: "row"; index: number }
	| { kind: "add" };

export function repeatableFocusTarget(deletedIndex: number, remainingCount: number): RepeatableFocusTarget {
	if (remainingCount <= 0) return { kind: "add" };
	return deletedIndex < remainingCount
		? { kind: "row", index: deletedIndex }
		: { kind: "row", index: remainingCount - 1 };
}

export type SectionNavigationKey = "ArrowLeft" | "ArrowUp" | "ArrowRight" | "ArrowDown" | "Home" | "End";

export function sectionNavigationTarget<T extends { key: string }>(
  sections: readonly T[],
  currentKey: EditorSection,
  key: SectionNavigationKey,
): T | undefined {
  const currentIndex = sections.findIndex((section) => section.key === currentKey);
  if (currentIndex < 0 || sections.length === 0) return undefined;

  const nextIndex = key === "Home"
    ? 0
    : key === "End"
      ? sections.length - 1
      : (currentIndex + (key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1) + sections.length) % sections.length;
  return sections[nextIndex];
}

export function updateMonsterName(monster: Monster, name: string): Monster {
  return { ...monster, name };
}

export function updateAbilityScore(monster: Monster, key: AbilityKey, score: number): Monster {
  const index = ABILITY_KEYS.indexOf(key);
  const scores = [...(monster.stats?.ability_scores ?? [10, 10, 10, 10, 10, 10])];
  scores[index] = score;
  return { ...monster, stats: { ...monster.stats, ability_scores: scores } };
}

export function updateListItem<T>(items: readonly T[], index: number, item: T): T[] {
  if (index < 0 || index >= items.length) return [...items];
  return items.map((entry, entryIndex) => (entryIndex === index ? item : entry));
}

export function removeListItem<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, entryIndex) => entryIndex !== index);
}

export function moveListItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function addLanguage(monster: Monster, entry: LanguageEntry): Monster {
  return { ...monster, language: [...(monster.language ?? []), { ...entry }] };
}

export function updateLanguage(monster: Monster, index: number, entry: LanguageEntry): Monster {
  return { ...monster, language: updateListItem(monster.language ?? [], index, { ...entry }) };
}

export function removeLanguage(monster: Monster, index: number): Monster {
  return { ...monster, language: removeListItem(monster.language ?? [], index) };
}

export function moveLanguage(monster: Monster, from: number, to: number): Monster {
  return { ...monster, language: moveListItem(monster.language ?? [], from, to) };
}
