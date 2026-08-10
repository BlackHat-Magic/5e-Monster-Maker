import type {
  AbilityKey,
  ActionItem,
  LanguageEntry,
  Monster,
  PresetName,
  Proficiencies,
  SizeName,
  SkillKey,
  Stats,
} from "./types";
import { excludeDefenseValues, sortDefenseValues } from "./defenses";
import { normalizeInnateSpellGroups, normalizeSpellcastingSpells, serializeInnateSpellGroups, serializeSpellcastingSpells } from "./spells";

const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const SKILL_KEYS: readonly SkillKey[] = [
  "acrobatics",
  "animal_handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight_of_hand",
  "stealth",
  "survival",
];
const SIZE_NAMES: readonly SizeName[] = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
const PRESET_NAMES: readonly PresetName[] = [
  "",
  "none",
  "attack",
  "legendary_resistance",
  "spellcasting",
  "innate_spellcasting",
];

const ABILITY_COUNT = 6;
const SPEED_COUNT = 5;
const SENSE_COUNT = 5;
type RecordLike = Record<string, unknown>;

const CHALLENGE_FRACTIONS = ["1/8", "1/4", "1/2"] as const;

export function isSupportedChallengeRating(value: unknown): value is number | string {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 && value <= 30;
  }
  if (typeof value !== "string") return false;
  return CHALLENGE_FRACTIONS.includes(value as (typeof CHALLENGE_FRACTIONS)[number]) || /^(?:0|[1-9]|[12][0-9]|30)$/.test(value);
}

export function normalizeChallengeRating(value: unknown, fallback = 0): number | string {
  return isSupportedChallengeRating(value) ? value : fallback;
}

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: RecordLike, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function ownValue(value: RecordLike, key: string): unknown {
  return hasOwn(value, key) ? value[key] : undefined;
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  const number = finiteNumber(value);
  return number !== undefined && number >= 0 && Number.isSafeInteger(number) ? number : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  const number = nonNegativeInteger(value);
  return number !== undefined && number > 0 ? number : undefined;
}

function nonNegativeDistance(value: unknown): number | string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const number = Number(trimmed);
    return trimmed !== "" && Number.isFinite(number) && number >= 0 && Number.isSafeInteger(number) ? value : undefined;
  }
  return nonNegativeInteger(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberOrString(value: unknown): number | string | undefined {
  if (typeof value === "string") return value;
  return finiteNumber(value);
}

function numericArray(value: unknown, length: number, fallback: number[], validator: (value: unknown) => number | undefined): number[] {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length }, (_, index) => validator(source[index]) ?? fallback[index] ?? 0);
}

function enumArray<T extends string>(value: unknown, values: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is T => isOneOf(entry, values));
}

function normalizeLanguageEntry(value: unknown): LanguageEntry | null {
  if (!isRecord(value)) return null;
  const name = ownValue(value, "name");
  const status = ownValue(value, "status");
  if (typeof name !== "string" || !isOneOf(status, ["speaks", "understands"] as const)) {
    return null;
  }

  const entry: LanguageEntry = { name, status };
  const but = stringValue(ownValue(value, "but"));
  if (but !== undefined) entry.but = but;
  return entry;
}

function normalizeActionItem(value: unknown): ActionItem | null {
  if (!isRecord(value) || typeof ownValue(value, "name") !== "string") return null;

  const item: ActionItem = { name: ownValue(value, "name") as string };
  const strings = [
    "description",
    "interval",
    "trigger",
    "damage_type",
    "class",
    "dice",
    "damage_type_save",
    "area",
    "targets",
  ] as const;
  for (const key of strings) {
    const string = stringValue(ownValue(value, key));
    if (string !== undefined) item[key] = string;
  }

  const preset = ownValue(value, "preset");
  const ability = ownValue(value, "ability");
  const dcAbility = ownValue(value, "dc_ability");
  const save = ownValue(value, "save");
  if (isOneOf(preset, PRESET_NAMES)) item.preset = preset;
  if (isOneOf(ability, ABILITY_KEYS) || ability === null) item.ability = ability;
  if (isOneOf(dcAbility, ABILITY_KEYS)) item.dc_ability = dcAbility;
  if (isOneOf(save, ABILITY_KEYS)) item.save = save;

  const nonNegativeFields = [
    "uses",
    "recharge_min",
    "recharge_max",
    "reach",
    "short_range",
    "long_range",
    "level",
  ] as const;
  for (const key of nonNegativeFields) {
    const number = nonNegativeInteger(ownValue(value, key));
    if (number !== undefined) item[key] = number;
  }
  for (const key of ["die_count", "die_size"] as const) {
    const number = positiveInteger(ownValue(value, key));
    if (number !== undefined) item[key] = number;
  }
  for (const key of ["reach", "short_range", "long_range"] as const) {
    if (ownValue(value, key) === null) item[key] = null;
  }

  for (const key of ["cost", "initiative"] as const) {
    const numberOrStringValue = numberOrString(ownValue(value, key));
    if (numberOrStringValue !== undefined) item[key] = numberOrStringValue;
  }

  const spells = ownValue(value, "spells");
  if (preset === "spellcasting") item.spells = serializeSpellcastingSpells(normalizeSpellcastingSpells(spells));
  if (preset === "innate_spellcasting") item.spells = serializeInnateSpellGroups(normalizeInnateSpellGroups(spells));
  return item;
}

function normalizeStats(value: unknown, fallback: Stats): Stats {
  const input = isRecord(value) ? value : {};
  const maxDexValue = ownValue(input, "max_dex");
  const maxDex = maxDexValue === -1 ? -1 : nonNegativeInteger(maxDexValue);
  return {
    ...fallback,
    base_ac: nonNegativeInteger(ownValue(input, "base_ac")) ?? fallback.base_ac ?? 10,
    add_dex: booleanValue(ownValue(input, "add_dex"), fallback.add_dex ?? false),
    max_dex: maxDex ?? fallback.max_dex ?? -1,
    armor: stringValue(ownValue(input, "armor")) ?? fallback.armor ?? "",
    hit_dice: nonNegativeInteger(ownValue(input, "hit_dice")) ?? fallback.hit_dice ?? 1,
    speed: numericArray(ownValue(input, "speed"), SPEED_COUNT, fallback.speed ?? [30, 0, 0, 0, 0], nonNegativeInteger),
    ability_scores: numericArray(
      ownValue(input, "ability_scores"),
      ABILITY_COUNT,
      fallback.ability_scores ?? [10, 10, 10, 10, 10, 10],
      nonNegativeInteger,
    ),
  };
}

function normalizeSenseArray(value: unknown, fallback: Array<number | string>): Array<number | string> {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: SENSE_COUNT }, (_, index) => nonNegativeDistance(source[index]) ?? fallback[index] ?? 0);
}

function normalizeProficiencies(value: unknown, fallback: Proficiencies): Proficiencies {
  const input = isRecord(value) ? value : {};
  const damageImmunities = Array.isArray(ownValue(input, "damage_immunities"))
    ? sortDefenseValues("damage", (ownValue(input, "damage_immunities") as unknown[]).filter((entry): entry is string => typeof entry === "string"))
    : [];
  const damageVulnerabilities = Array.isArray(ownValue(input, "damage_vulnerabilities"))
    ? (ownValue(input, "damage_vulnerabilities") as unknown[]).filter((entry): entry is string => typeof entry === "string")
    : [];
  const damageResistances = Array.isArray(ownValue(input, "damage_resistances"))
    ? (ownValue(input, "damage_resistances") as unknown[]).filter((entry): entry is string => typeof entry === "string")
    : [];
  return {
    ...fallback,
    saves: enumArray(ownValue(input, "saves"), ABILITY_KEYS),
    skills: enumArray(ownValue(input, "skills"), SKILL_KEYS),
    expertise: enumArray(ownValue(input, "expertise"), SKILL_KEYS),
    damage_vulnerabilities: excludeDefenseValues("damage", damageVulnerabilities, damageImmunities),
    damage_resistances: excludeDefenseValues("damage", damageResistances, damageImmunities),
    damage_immunities: damageImmunities,
    condition_immunities: Array.isArray(ownValue(input, "condition_immunities"))
      ? sortDefenseValues("condition", (ownValue(input, "condition_immunities") as unknown[]).filter((entry): entry is string => typeof entry === "string"))
      : [],
    senses: normalizeSenseArray(ownValue(input, "senses"), fallback.senses ?? [0, 0, 0, 0, 0]),
    challenge: normalizeChallengeRating(ownValue(input, "challenge")),
  };
}

function normalizeRepeatable<T>(value: unknown, normalize: (value: unknown) => T | null): T[] {
  return Array.isArray(value) ? value.map(normalize).filter((entry): entry is T => entry !== null) : [];
}

export function createDefaultMonster(): Monster {
  return {
    name: "New Monster",
    shortened_name: "",
    shortened_plural: "",
    proper_noun: false,
    is_legendary: false,
    legendary_description: "",
    is_villain: false,
    villain_description: "",
    is_mythic: false,
    mythic_description: "",
    basics: {
      size: "medium",
      type: "",
      tag: "",
      alignment: "",
      flavor: "",
    },
    stats: {
      base_ac: 10,
      add_dex: false,
      max_dex: -1,
      armor: "",
      hit_dice: 1,
      speed: [30, 0, 0, 0, 0],
      ability_scores: [10, 10, 10, 10, 10, 10],
    },
    proficiencies: {
      saves: [],
      skills: [],
      expertise: [],
      damage_vulnerabilities: [],
      damage_resistances: [],
      damage_immunities: [],
      condition_immunities: [],
      senses: [0, 0, 0, 0, 0],
      challenge: 0,
    },
    language: [],
    ability: [],
    action: [],
    bonus_action: [],
    reaction: [],
    legendary_action: [],
    villain_action: [],
    mythic_action: [],
  };
}

export function normalizeMonster(input: unknown): Monster {
  const source = isRecord(input) ? input : {};
  const defaults = createDefaultMonster();
  const basicsValue = ownValue(source, "basics");
  const basics = isRecord(basicsValue) ? basicsValue : {};
  const normalized: Monster = {
    ...defaults,
    name: stringValue(ownValue(source, "name")) ?? defaults.name ?? "New Monster",
    shortened_name: stringValue(ownValue(source, "shortened_name")) ?? defaults.shortened_name ?? "",
    shortened_plural: stringValue(ownValue(source, "shortened_plural")) ?? defaults.shortened_plural ?? "",
    proper_noun: booleanValue(ownValue(source, "proper_noun"), defaults.proper_noun ?? false),
    is_legendary: booleanValue(ownValue(source, "is_legendary"), defaults.is_legendary ?? false),
    legendary_description: stringValue(ownValue(source, "legendary_description")) ?? defaults.legendary_description ?? "",
    is_villain: booleanValue(ownValue(source, "is_villain"), defaults.is_villain ?? false),
    villain_description: stringValue(ownValue(source, "villain_description")) ?? defaults.villain_description ?? "",
    is_mythic: booleanValue(ownValue(source, "is_mythic"), defaults.is_mythic ?? false),
    mythic_description: stringValue(ownValue(source, "mythic_description")) ?? defaults.mythic_description ?? "",
    basics: {
      ...defaults.basics,
      size: isOneOf(ownValue(basics, "size"), SIZE_NAMES) ? (ownValue(basics, "size") as SizeName) : defaults.basics?.size ?? "medium",
      type: stringValue(ownValue(basics, "type")) ?? defaults.basics?.type ?? "",
      tag: stringValue(ownValue(basics, "tag")) ?? defaults.basics?.tag ?? "",
      alignment: stringValue(ownValue(basics, "alignment")) ?? defaults.basics?.alignment ?? "",
      flavor: stringValue(ownValue(basics, "flavor")) ?? defaults.basics?.flavor ?? "",
    },
    stats: normalizeStats(ownValue(source, "stats"), defaults.stats ?? {}),
    proficiencies: normalizeProficiencies(ownValue(source, "proficiencies"), defaults.proficiencies ?? {}),
  };

  normalized.language = normalizeRepeatable(ownValue(source, "language"), normalizeLanguageEntry);
  normalized.ability = normalizeRepeatable(ownValue(source, "ability"), normalizeActionItem);
  normalized.action = normalizeRepeatable(ownValue(source, "action"), normalizeActionItem);
  normalized.bonus_action = normalizeRepeatable(ownValue(source, "bonus_action"), normalizeActionItem);
  normalized.reaction = normalizeRepeatable(ownValue(source, "reaction"), normalizeActionItem);
  normalized.legendary_action = normalizeRepeatable(ownValue(source, "legendary_action"), normalizeActionItem);
  normalized.villain_action = normalizeRepeatable(ownValue(source, "villain_action"), normalizeActionItem);
  normalized.mythic_action = normalizeRepeatable(ownValue(source, "mythic_action"), normalizeActionItem);

  return normalized;
}
