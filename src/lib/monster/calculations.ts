import type { AbilityKey, Monster, SenseLabel, SizeName, SkillKey, SpeedLabel } from "./types";

export const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
export const ABILITY_LONG: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export const SKILL_ABILITY: Record<SkillKey, AbilityKey> = {
  acrobatics: "dex",
  animal_handling: "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  sleight_of_hand: "dex",
  stealth: "dex",
  survival: "wis",
};

export const ALL_SKILLS = SKILL_ABILITY;
export const SKILL_KEYS: SkillKey[] = Object.keys(SKILL_ABILITY) as SkillKey[];
export const SKILL_DISPLAY: Record<SkillKey, string> = {
  acrobatics: "Acrobatics",
  animal_handling: "Animal Handling",
  arcana: "Arcana",
  athletics: "Athletics",
  deception: "Deception",
  history: "History",
  insight: "Insight",
  intimidation: "Intimidation",
  investigation: "Investigation",
  medicine: "Medicine",
  nature: "Nature",
  perception: "Perception",
  performance: "Performance",
  persuasion: "Persuasion",
  religion: "Religion",
  sleight_of_hand: "Sleight of Hand",
  stealth: "Stealth",
  survival: "Survival",
};

export const SIZE_HIT_DIE: Record<SizeName, number> = {
  tiny: 4,
  small: 6,
  medium: 8,
  large: 10,
  huge: 12,
  gargantuan: 20,
};

export const CR_XP: Array<[number, number]> = [
  [0, 10],
  [0.125, 25],
  [0.25, 50],
  [0.5, 100],
  [1, 200],
  [2, 450],
  [3, 700],
  [4, 1100],
  [5, 1800],
  [6, 2300],
  [7, 2900],
  [8, 3900],
  [9, 5000],
  [10, 5900],
  [11, 7200],
  [12, 8400],
  [13, 10000],
  [14, 11500],
  [15, 13000],
  [16, 15000],
  [17, 18000],
  [18, 20000],
  [19, 22000],
  [20, 25000],
  [21, 33000],
  [22, 41000],
  [23, 50000],
  [24, 62000],
  [25, 75000],
  [26, 90000],
  [27, 105000],
  [28, 120000],
  [29, 135000],
  [30, 155000],
];

export function parseCR(cr: number | string | null | undefined): number {
  if (cr == null) return 0;
  if (typeof cr === "number") return Number.isFinite(cr) ? cr : 0;
  const value = cr.trim().toLowerCase();
  if (value === "") return 0;
  if (value.includes("/")) {
    const [numerator, denominator] = value.split("/").map((part) => Number(part.trim()));
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
  }
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function crLabel(cr: number | string | null | undefined): string {
  const value = parseCR(cr);
  if (value === 0) return "0";
  if (value === 0.125) return "1/8";
  if (value === 0.25) return "1/4";
  if (value === 0.5) return "1/2";
  if (Number.isInteger(value)) return String(value);
  return cr == null ? "0" : String(cr);
}

export function proficiencyBonus(cr: number | string | null | undefined): number {
  const value = parseCR(cr);
  if (value <= 4) return 2;
  if (value <= 8) return 3;
  if (value <= 12) return 4;
  if (value <= 16) return 5;
  if (value <= 20) return 6;
  if (value <= 24) return 7;
  if (value <= 28) return 8;
  return 9;
}

export function xpForCR(cr: number | string | null | undefined): number {
  const value = parseCR(cr);
  let best = 0;
  for (const [threshold, xp] of CR_XP) {
    if (value >= threshold) best = xp;
  }
  return best;
}

export function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

export function abilityMod(score: number | undefined): number {
  return Math.floor(((score ?? 10) - 10) / 2);
}

function abilityScoreValues(monster: Monster): number[] {
  const scores = monster.stats?.ability_scores ?? [];
  return ABILITY_KEYS.map((_, index) => scores[index] ?? 10);
}

export function abilityMods(monster: Monster): Record<AbilityKey, number> {
  const scores = abilityScoreValues(monster);
  return {
    str: abilityMod(scores[0]),
    dex: abilityMod(scores[1]),
    con: abilityMod(scores[2]),
    int: abilityMod(scores[3]),
    wis: abilityMod(scores[4]),
    cha: abilityMod(scores[5]),
  };
}

export function abilityScores(monster: Monster): Record<AbilityKey, number> {
  const scores = abilityScoreValues(monster);
  return {
    str: scores[0],
    dex: scores[1],
    con: scores[2],
    int: scores[3],
    wis: scores[4],
    cha: scores[5],
  };
}

export function proficiencyFromMonster(monster: Monster): number {
  return proficiencyBonus(monster.proficiencies?.challenge);
}

export function armorClass(monster: Monster): number {
  const stats = monster.stats ?? {};
  const mods = abilityMods(monster);
  let ac = stats.base_ac ?? 10;
  if (stats.add_dex) {
    const maxDex = stats.max_dex;
    ac += typeof maxDex === "number" && maxDex >= 0 ? Math.min(mods.dex, maxDex) : mods.dex;
  }
  return ac;
}

export function diceAverage(count: number, die: number): number {
  return Math.floor((count * (die + 1)) / 2);
}

export function hitPoints(monster: Monster): { hp: number; formula: string } {
  const size = (monster.basics?.size ?? "medium").toLowerCase() as SizeName;
  const die = SIZE_HIT_DIE[size] ?? 8;
  const count = monster.stats?.hit_dice ?? 1;
  const conBonus = abilityMods(monster).con * count;
  const hp = diceAverage(count, die) + conBonus;
  const formula = conBonus >= 0 ? `${count}d${die} + ${conBonus}` : `${count}d${die} - ${Math.abs(conBonus)}`;
  return { hp, formula };
}

export function saveDC(monster: Monster, ability: AbilityKey): number {
  return 8 + abilityMods(monster)[ability] + proficiencyFromMonster(monster);
}

export function attackMod(monster: Monster, ability: AbilityKey): number {
  return abilityMods(monster)[ability] + proficiencyFromMonster(monster);
}

export function skillAbility(skill: string): AbilityKey {
  return SKILL_ABILITY[skill.toLowerCase() as SkillKey] ?? "wis";
}

export function skillDisplayName(skill: string): string {
  return SKILL_DISPLAY[skill.toLowerCase() as SkillKey] ?? skill;
}

export interface SpeedEntry {
  label: SpeedLabel | SenseLabel;
  ft: number;
}

export const SPEED_LABELS: SpeedLabel[] = ["walk", "burrow", "climb", "fly", "swim"];

export function speedList(monster: Monster): SpeedEntry[] {
  const speeds = monster.stats?.speed ?? [];
  const entries: SpeedEntry[] = [];
  for (let index = 0; index < SPEED_LABELS.length; index++) {
    const value = speeds[index];
    if (value == null) continue;
    const feet = Number(value);
    if (!Number.isFinite(feet)) continue;
    if (index === 0 || feet > 0) entries.push({ label: SPEED_LABELS[index], ft: feet });
  }
  return entries;
}

export const SENSE_LABELS: SenseLabel[] = ["blindsight", "darkvision", "tremorsense", "truesight", "telepathy"];

export function senseList(monster: Monster): SpeedEntry[] {
  const senses = monster.proficiencies?.senses ?? [];
  const entries: SpeedEntry[] = [];
  for (let index = 0; index < 4; index++) {
    const value = senses[index];
    if (value == null) continue;
    const feet = Number(value);
    if (Number.isFinite(feet) && feet > 0) entries.push({ label: SENSE_LABELS[index], ft: feet });
  }
  return entries;
}

export function telepathyFt(monster: Monster): number | null {
  const value = monster.proficiencies?.senses?.[4];
  if (value == null) return null;
  const feet = Number(value);
  return Number.isFinite(feet) && feet > 0 ? feet : null;
}

export function displayName(monster: Monster): string {
  const shortened = monster.shortened_name?.trim();
  if (shortened) {
    if (monster.proper_noun || /^the\b/i.test(shortened)) return shortened;
    return `the ${shortened}`;
  }
	return monster.name?.trim() || "the monster";
}

export function pluralName(monster: Monster): string {
	return monster.shortened_plural?.trim() || monster.name?.trim() || "the monsters";
}

export function passivePerception(monster: Monster): number {
  const mods = abilityMods(monster);
  const proficiency = proficiencyFromMonster(monster);
  let bonus = mods.wis;
  const skills = monster.proficiencies?.skills ?? [];
  const expertise = monster.proficiencies?.expertise ?? [];
  if (expertise.includes("perception")) bonus += proficiency * 2;
  else if (skills.includes("perception")) bonus += proficiency;
  return 10 + bonus;
}
