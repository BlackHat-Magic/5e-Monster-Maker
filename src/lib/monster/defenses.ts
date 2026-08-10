import type { Proficiencies } from "./types";

export type DefenseKind = "damage" | "condition";

export const DAMAGE_CANONICAL_VALUES = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
  "nonmagical attacks",
  "nonmagical, non-silvered attacks",
  "nonmagical, non-adamantine attacks",
] as const;

export const CONDITION_CANONICAL_VALUES = [
  "blinded",
  "charmed",
  "deafened",
  "exhaustion",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
] as const;

export const DAMAGE_VALUES = DAMAGE_CANONICAL_VALUES;
export const CONDITION_VALUES = CONDITION_CANONICAL_VALUES;

export type DamageDefenseValue = (typeof DAMAGE_CANONICAL_VALUES)[number];
export type ConditionDefenseValue = (typeof CONDITION_CANONICAL_VALUES)[number];

export const DAMAGE_LABELS: Record<DamageDefenseValue, string> = {
  acid: "Acid",
  bludgeoning: "Bludgeoning",
  cold: "Cold",
  fire: "Fire",
  force: "Force",
  lightning: "Lightning",
  necrotic: "Necrotic",
  piercing: "Piercing",
  poison: "Poison",
  psychic: "Psychic",
  radiant: "Radiant",
  slashing: "Slashing",
  thunder: "Thunder",
  "nonmagical attacks": "Nonmagical Attacks",
  "nonmagical, non-silvered attacks": "Nonmagical, Non-Silvered Attacks",
  "nonmagical, non-adamantine attacks": "Nonmagical, Non-Adamantine Attacks",
};

export const CONDITION_LABELS: Record<ConditionDefenseValue, string> = {
  blinded: "Blinded",
  charmed: "Charmed",
  deafened: "Deafened",
  exhaustion: "Exhaustion",
  frightened: "Frightened",
  grappled: "Grappled",
  incapacitated: "Incapacitated",
  invisible: "Invisible",
  paralyzed: "Paralyzed",
  petrified: "Petrified",
  poisoned: "Poisoned",
  prone: "Prone",
  restrained: "Restrained",
  stunned: "Stunned",
  unconscious: "Unconscious",
};

const canonicalValues: Record<DefenseKind, readonly string[]> = {
  damage: DAMAGE_CANONICAL_VALUES,
  condition: CONDITION_CANONICAL_VALUES,
};

const labels: Record<DefenseKind, Record<string, string>> = {
  damage: DAMAGE_LABELS,
  condition: CONDITION_LABELS,
};

function canonicalValue(kind: DefenseKind, value: string): string | undefined {
  const normalized = value.trim().toLowerCase();
  return canonicalValues[kind].find((entry) => entry === normalized);
}

export function defenseLabel(kind: DefenseKind, value: string): string {
  const normalized = value.trim();
  const canonical = canonicalValue(kind, normalized);
  return canonical ? labels[kind][canonical] : normalized;
}

export function sortDefenseValues(kind: DefenseKind, values: readonly string[]): string[] {
  const seen = new Set<string>();
  const canonical = new Set<string>();
  const custom: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const normalized = canonicalValue(kind, trimmed) ?? trimmed;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    if (canonicalValues[kind].includes(normalized)) canonical.add(normalized);
    else custom.push(normalized);
  }

  return [...canonicalValues[kind].filter((value) => canonical.has(value)), ...custom];
}

export function excludeDefenseValues(kind: DefenseKind, values: readonly string[], excludedValues: readonly string[]): string[] {
  const excluded = new Set(sortDefenseValues(kind, excludedValues).map((value) => value.toLowerCase()));
  return sortDefenseValues(kind, values).filter((value) => !excluded.has(value.toLowerCase()));
}

export function addDefenseValue(kind: DefenseKind, values: readonly string[], value: string): string[] {
  return sortDefenseValues(kind, [...values, value]);
}

export function removeDefenseValue(kind: DefenseKind, values: readonly string[], value: string): string[] {
  const key = value.trim().toLowerCase();
  if (!key) return sortDefenseValues(kind, values);
  return sortDefenseValues(kind, values.filter((entry) => entry.trim().toLowerCase() !== key));
}

export function addImmunity(proficiencies: Proficiencies, value: string): Proficiencies {
  const trimmed = value.trim();
  if (!trimmed) return { ...proficiencies };

  return {
    ...proficiencies,
    damage_vulnerabilities: removeDefenseValue("damage", proficiencies.damage_vulnerabilities ?? [], trimmed),
    damage_resistances: removeDefenseValue("damage", proficiencies.damage_resistances ?? [], trimmed),
    damage_immunities: addDefenseValue("damage", proficiencies.damage_immunities ?? [], trimmed),
  };
}
