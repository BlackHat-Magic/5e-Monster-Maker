import { parse, stringify } from "smol-toml";
import { isSupportedChallengeRating, normalizeMonster } from "./defaults";
import { collectSpellWarnings } from "./spells";
import type { ActionItem, LanguageEntry, Monster } from "./types";

export type TomlWarning = { path: string; message: string };

export type ImportResult =
  | { ok: true; monster: Monster; warnings: TomlWarning[] }
  | { ok: false; message: string };

type RecordLike = Record<string, unknown>;

const TOP_LEVEL_KEYS = [
  "name",
  "shortened_name",
  "shortened_plural",
  "proper_noun",
  "is_legendary",
  "legendary_description",
  "is_villain",
  "villain_description",
  "is_mythic",
  "mythic_description",
  "basics",
  "stats",
  "proficiencies",
  "language",
  "ability",
  "action",
  "bonus_action",
  "reaction",
  "legendary_action",
  "villain_action",
  "mythic_action",
] as const;

const BASICS_KEYS = ["size", "type", "tag", "alignment", "flavor"] as const;
const STATS_KEYS = ["base_ac", "add_dex", "max_dex", "armor", "hit_dice", "speed", "ability_scores"] as const;
const PROFICIENCY_KEYS = [
  "saves",
  "skills",
  "expertise",
  "damage_vulnerabilities",
  "damage_resistances",
  "damage_immunities",
  "condition_immunities",
  "senses",
  "challenge",
] as const;
const LANGUAGE_KEYS = ["name", "status", "but"] as const;
const ACTION_KEYS = [
  "name",
  "preset",
  "description",
  "uses",
  "interval",
  "recharge_min",
  "recharge_max",
  "cost",
  "initiative",
  "trigger",
  "reach",
  "short_range",
  "long_range",
  "ability",
  "die_count",
  "die_size",
  "damage_type",
  "level",
  "class",
  "spells",
  "dc_ability",
  "save",
  "dice",
  "damage_type_save",
  "area",
  "targets",
] as const;

const REPEATABLE_KEYS = [
  "language",
  "ability",
  "action",
  "bonus_action",
  "reaction",
  "legendary_action",
  "villain_action",
  "mythic_action",
] as const;

const CHALLENGE_RATING_MESSAGE = "Expected 0, 1/8, 1/4, 1/2, or an integer from 1 through 30; the value was replaced with 0.";

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: RecordLike, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function createRecord(): RecordLike {
  return Object.create(null) as RecordLike;
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!isRecord(value)) return value;

  const copy = createRecord();
  for (const [key, nested] of Object.entries(value)) copy[key] = cloneValue(nested);
  return copy;
}

function warnUnknownKeys(
  value: unknown,
  path: string,
  knownKeys: readonly string[],
  warnings: TomlWarning[],
  nested?: (key: string, value: unknown, path: string) => void,
): void {
  if (!isRecord(value)) return;
  for (const [key, nestedValue] of Object.entries(value)) {
    const keyPath = path ? `${path}.${key}` : key;
    if (!knownKeys.includes(key)) {
      warnings.push({ path: keyPath, message: `Unsupported key: ${keyPath}` });
      continue;
    }
    nested?.(key, nestedValue, keyPath);
  }
}

function collectWarnings(source: RecordLike): TomlWarning[] {
  const warnings: TomlWarning[] = [];
  warnUnknownKeys(source, "", TOP_LEVEL_KEYS, warnings, (key, value, path) => {
    if (key === "basics") warnUnknownKeys(value, path, BASICS_KEYS, warnings);
    else if (key === "stats") warnUnknownKeys(value, path, STATS_KEYS, warnings);
    else if (key === "proficiencies") warnUnknownKeys(value, path, PROFICIENCY_KEYS, warnings);
    else if (REPEATABLE_KEYS.includes(key as (typeof REPEATABLE_KEYS)[number]) && Array.isArray(value)) {
      const keys = key === "language" ? LANGUAGE_KEYS : ACTION_KEYS;
      value.forEach((entry, index) => {
        warnUnknownKeys(entry, `${path}[${index}]`, keys, warnings);
      });
    }
  });
  return warnings;
}

function invalidWarning(warnings: TomlWarning[], path: string, message: string): void {
  warnings.push({ path, message });
}

function warnString(warnings: TomlWarning[], source: RecordLike, key: string, path: string): void {
  if (hasOwn(source, key) && typeof source[key] !== "string") {
    invalidWarning(warnings, path, "Expected a string; the value was ignored.");
  }
}

function warnBoolean(warnings: TomlWarning[], source: RecordLike, key: string, path: string): void {
  if (hasOwn(source, key) && typeof source[key] !== "boolean") {
    invalidWarning(warnings, path, "Expected a boolean; the value was replaced with the default.");
  }
}

function warnEnum(warnings: TomlWarning[], source: RecordLike, key: string, path: string, values: readonly string[]): void {
  if (hasOwn(source, key) && (typeof source[key] !== "string" || !values.includes(source[key]))) {
    invalidWarning(warnings, path, `Expected one of: ${values.join(", ")}; the value was replaced or dropped.`);
  }
}

function isNonNegativeInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): boolean {
  return isNonNegativeInteger(value) && (value as number) > 0;
}

function isDistance(value: unknown): boolean {
  if (typeof value === "string") {
    const number = Number(value.trim());
    return value.trim() !== "" && Number.isSafeInteger(number) && number >= 0;
  }
  return isNonNegativeInteger(value);
}

function warnNonNegativeInteger(warnings: TomlWarning[], source: RecordLike, key: string, path: string): void {
  if (hasOwn(source, key) && !isNonNegativeInteger(source[key])) {
    invalidWarning(warnings, path, "Expected a non-negative integer; the value was replaced or dropped.");
  }
}

function warnFixedArray(
  warnings: TomlWarning[],
  source: RecordLike,
  key: string,
  path: string,
  length: number,
  validator: (value: unknown) => boolean,
): void {
  if (!hasOwn(source, key)) return;
  const value = source[key];
  if (!Array.isArray(value)) {
    invalidWarning(warnings, path, `Expected an array of ${length} values; the value was replaced with defaults.`);
    return;
  }
  if (value.length !== length) {
    invalidWarning(warnings, path, `Expected exactly ${length} values; received ${value.length}.`);
  }
  value.slice(0, length).forEach((entry, index) => {
    if (!validator(entry)) invalidWarning(warnings, `${path}[${index}]`, "Invalid value; the default was used.");
  });
}

function warnStringArray(warnings: TomlWarning[], source: RecordLike, key: string, path: string, rejectBlank = false): void {
  if (!hasOwn(source, key)) return;
  const value = source[key];
  if (!Array.isArray(value)) {
    invalidWarning(warnings, path, "Expected an array of strings; the value was replaced with an empty array.");
    return;
  }
  value.forEach((entry, index) => {
    if (typeof entry !== "string") invalidWarning(warnings, `${path}[${index}]`, "Expected a string; the entry was dropped.");
    else if (rejectBlank && entry.trim() === "") invalidWarning(warnings, `${path}[${index}]`, "Expected a non-empty string; the blank entry was dropped.");
  });
}

function warnEnumArray(
  warnings: TomlWarning[],
  source: RecordLike,
  key: string,
  path: string,
  values: readonly string[],
): void {
  if (!hasOwn(source, key)) return;
  const value = source[key];
  if (!Array.isArray(value)) {
    invalidWarning(warnings, path, "Expected an array; the value was replaced with an empty array.");
    return;
  }
  value.forEach((entry, index) => {
    if (typeof entry !== "string" || !values.includes(entry)) {
      invalidWarning(warnings, `${path}[${index}]`, `Invalid enum value; expected one of: ${values.join(", ")}.`);
    }
  });
}

function warnLanguageEntry(warnings: TomlWarning[], value: unknown, path: string): void {
  if (!isRecord(value)) {
    invalidWarning(warnings, path, "Expected a language table; the entry was dropped.");
    return;
  }
  warnString(warnings, value, "name", `${path}.name`);
  if (!hasOwn(value, "name")) invalidWarning(warnings, `${path}.name`, "A language name is required; the entry was dropped.");
  warnEnum(warnings, value, "status", `${path}.status`, ["speaks", "understands"]);
  if (!hasOwn(value, "status")) invalidWarning(warnings, `${path}.status`, "A language status is required; the entry was dropped.");
  warnString(warnings, value, "but", `${path}.but`);
}

function warnActionEntry(warnings: TomlWarning[], value: unknown, path: string): void {
  if (!isRecord(value)) {
    invalidWarning(warnings, path, "Expected an action table; the entry was dropped.");
    return;
  }

  warnString(warnings, value, "name", `${path}.name`);
  if (!hasOwn(value, "name")) invalidWarning(warnings, `${path}.name`, "An action name is required; the entry was dropped.");
  warnEnum(warnings, value, "preset", `${path}.preset`, ["", "none", "attack", "legendary_resistance", "spellcasting", "innate_spellcasting"]);
  warnString(warnings, value, "description", `${path}.description`);
  warnString(warnings, value, "interval", `${path}.interval`);
  warnString(warnings, value, "trigger", `${path}.trigger`);
  warnString(warnings, value, "damage_type", `${path}.damage_type`);
  warnString(warnings, value, "class", `${path}.class`);
  warnString(warnings, value, "dice", `${path}.dice`);
  warnString(warnings, value, "damage_type_save", `${path}.damage_type_save`);
  warnString(warnings, value, "area", `${path}.area`);
  warnString(warnings, value, "targets", `${path}.targets`);
  warnNonNegativeInteger(warnings, value, "uses", `${path}.uses`);
  warnNonNegativeInteger(warnings, value, "recharge_min", `${path}.recharge_min`);
  warnNonNegativeInteger(warnings, value, "recharge_max", `${path}.recharge_max`);
  warnNonNegativeInteger(warnings, value, "level", `${path}.level`);
  for (const key of ["reach", "short_range", "long_range"] as const) {
    if (hasOwn(value, key) && value[key] !== null && !isNonNegativeInteger(value[key])) {
      invalidWarning(warnings, `${path}.${key}`, "Expected a non-negative integer or null; the value was replaced or dropped.");
    }
  }
  for (const key of ["die_count", "die_size"] as const) {
    if (hasOwn(value, key) && !isPositiveInteger(value[key])) {
      invalidWarning(warnings, `${path}.${key}`, "Expected a positive integer; the value was dropped.");
    }
  }
  for (const key of ["cost", "initiative"] as const) {
    if (hasOwn(value, key) && typeof value[key] !== "string" && !(typeof value[key] === "number" && Number.isFinite(value[key]))) {
      invalidWarning(warnings, `${path}.${key}`, "Expected a finite number or string; the value was dropped.");
    }
  }
  if (hasOwn(value, "ability") && value.ability !== null) {
    warnEnum(warnings, value, "ability", `${path}.ability`, ["str", "dex", "con", "int", "wis", "cha"]);
  }
  warnEnum(warnings, value, "dc_ability", `${path}.dc_ability`, ["str", "dex", "con", "int", "wis", "cha"]);
  warnEnum(warnings, value, "save", `${path}.save`, ["str", "dex", "con", "int", "wis", "cha"]);
  if (hasOwn(value, "spells")) {
    if (value.preset === "spellcasting") warnings.push(...collectSpellWarnings(value.spells, `${path}.spells`, "spellcasting"));
    else if (value.preset === "innate_spellcasting") warnings.push(...collectSpellWarnings(value.spells, `${path}.spells`, "innate"));
    else invalidWarning(warnings, `${path}.spells`, "Spell data requires a spellcasting or innate_spellcasting preset; the value was dropped.");
  }
}

function collectInvalidWarnings(source: RecordLike): TomlWarning[] {
  const warnings: TomlWarning[] = [];
  for (const key of [
    "name",
    "shortened_name",
    "shortened_plural",
    "legendary_description",
    "villain_description",
    "mythic_description",
  ]) warnString(warnings, source, key, key);
  for (const key of ["proper_noun", "is_legendary", "is_villain", "is_mythic"]) warnBoolean(warnings, source, key, key);

  const basics = source.basics;
  if (hasOwn(source, "basics")) {
    if (!isRecord(basics)) invalidWarning(warnings, "basics", "Expected a table; the value was replaced with defaults.");
    else {
      warnEnum(warnings, basics, "size", "basics.size", ["tiny", "small", "medium", "large", "huge", "gargantuan"]);
      for (const key of ["type", "tag", "alignment", "flavor"]) warnString(warnings, basics, key, `basics.${key}`);
    }
  }

  const stats = source.stats;
  if (hasOwn(source, "stats")) {
    if (!isRecord(stats)) invalidWarning(warnings, "stats", "Expected a table; the value was replaced with defaults.");
    else {
      warnNonNegativeInteger(warnings, stats, "base_ac", "stats.base_ac");
      if (hasOwn(stats, "max_dex") && stats.max_dex !== -1) warnNonNegativeInteger(warnings, stats, "max_dex", "stats.max_dex");
      warnBoolean(warnings, stats, "add_dex", "stats.add_dex");
      warnString(warnings, stats, "armor", "stats.armor");
      warnNonNegativeInteger(warnings, stats, "hit_dice", "stats.hit_dice");
      warnFixedArray(warnings, stats, "speed", "stats.speed", 5, isNonNegativeInteger);
      warnFixedArray(warnings, stats, "ability_scores", "stats.ability_scores", 6, isNonNegativeInteger);
    }
  }

  const proficiencies = source.proficiencies;
  if (hasOwn(source, "proficiencies")) {
    if (!isRecord(proficiencies)) invalidWarning(warnings, "proficiencies", "Expected a table; the value was replaced with defaults.");
    else {
      warnEnumArray(warnings, proficiencies, "saves", "proficiencies.saves", ["str", "dex", "con", "int", "wis", "cha"]);
      warnEnumArray(warnings, proficiencies, "skills", "proficiencies.skills", ["acrobatics", "animal_handling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight_of_hand", "stealth", "survival"]);
      warnEnumArray(warnings, proficiencies, "expertise", "proficiencies.expertise", ["acrobatics", "animal_handling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight_of_hand", "stealth", "survival"]);
      warnStringArray(warnings, proficiencies, "damage_vulnerabilities", "proficiencies.damage_vulnerabilities", true);
      warnStringArray(warnings, proficiencies, "damage_resistances", "proficiencies.damage_resistances", true);
      warnStringArray(warnings, proficiencies, "damage_immunities", "proficiencies.damage_immunities", true);
      warnStringArray(warnings, proficiencies, "condition_immunities", "proficiencies.condition_immunities", true);
      warnFixedArray(warnings, proficiencies, "senses", "proficiencies.senses", 5, isDistance);
      if (hasOwn(proficiencies, "challenge") && !isSupportedChallengeRating(proficiencies.challenge)) {
        invalidWarning(warnings, "proficiencies.challenge", CHALLENGE_RATING_MESSAGE);
      }
    }
  }

  for (const key of REPEATABLE_KEYS) {
    if (!hasOwn(source, key)) continue;
    const value = source[key];
    if (!Array.isArray(value)) {
      invalidWarning(warnings, key, "Expected an array of tables; the value was replaced with an empty array.");
      continue;
    }
    value.forEach((entry, index) => {
      const path = `${key}[${index}]`;
      if (key === "language") warnLanguageEntry(warnings, entry, path);
      else warnActionEntry(warnings, entry, path);
    });
  }
  return warnings;
}

function addFields(target: RecordLike, source: RecordLike, keys: readonly string[]): void {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) target[key] = cloneValue(value);
  }
}

function cleanLanguageEntries(entries: LanguageEntry[] | undefined): LanguageEntry[] {
  return (entries ?? []).filter((entry) => entry && entry.name.trim() !== "" && entry.status);
}

function cleanActionEntries(entries: ActionItem[] | undefined): ActionItem[] {
  return (entries ?? []).filter((entry) => entry && entry.name.trim() !== "");
}

function exportProjection(monster: Monster): RecordLike {
  const normalized = normalizeMonster(monster);
  const output = createRecord();

  addFields(output, normalized as RecordLike, TOP_LEVEL_KEYS.slice(0, 10));

  const basics = createRecord();
  addFields(basics, (normalized.basics ?? {}) as RecordLike, BASICS_KEYS);
  output.basics = basics;

  const stats = createRecord();
  addFields(stats, (normalized.stats ?? {}) as RecordLike, STATS_KEYS);
  output.stats = stats;

  const proficiencies = createRecord();
  addFields(proficiencies, (normalized.proficiencies ?? {}) as RecordLike, PROFICIENCY_KEYS);
  output.proficiencies = proficiencies;

  output.language = cleanLanguageEntries(normalized.language).map((entry) => {
    const item = createRecord();
    addFields(item, entry as unknown as RecordLike, LANGUAGE_KEYS);
    return item;
  });

  for (const key of REPEATABLE_KEYS.slice(1)) {
    output[key] = cleanActionEntries(normalized[key as keyof Monster] as ActionItem[] | undefined).map((entry) => {
      const item = createRecord();
      addFields(item, entry as unknown as RecordLike, ACTION_KEYS);
      return item;
    });
  }

  return output;
}

export function importMonsterToml(source: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Unable to parse TOML: ${message}` };
  }

  if (!isRecord(parsed)) return { ok: false, message: "TOML root must be a table." };

  return {
    ok: true,
    monster: normalizeMonster(parsed),
    warnings: [...collectWarnings(parsed), ...collectInvalidWarnings(parsed)],
  };
}

export function exportMonsterToml(monster: Monster): string {
  return stringify(exportProjection(monster));
}

export function filenameForMonster(monster: Monster): string {
  const name = typeof monster.name === "string" ? monster.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "") : "";
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `${slug}.toml` : "monster.toml";
}
