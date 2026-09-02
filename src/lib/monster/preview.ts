import {
  ABILITY_KEYS,
  abilityMods,
  abilityScores,
  armorClass,
  crLabel,
  hitPoints,
  passivePerception,
  proficiencyFromMonster,
  senseList,
  signed,
  skillAbility,
  skillDisplayName,
  speedList,
  telepathyFt,
  xpForCR,
  displayName,
} from "./calculations";
import { markdownToHtml } from "./markdown";
import { finalizeDescription, itemSuffix, presetDescription } from "./presets";
import { excludeDefenseValues, sortDefenseValues } from "./defenses";
import type { AbilityKey, ActionItem, LanguageEntry, Monster } from "./types";

export interface PreviewText {
  markdown: string;
  html: string;
}

export interface LabeledPreview extends PreviewText {
  label: string;
  value: string;
}

export interface AbilityRow {
  key: AbilityKey;
  label: string;
  score: number;
  modifier: number;
  modifierText: string;
}

export interface ChallengePreview extends PreviewText {
  challenge: string;
  xp: number;
  xpText: string;
  proficiencyBonus: number;
  proficiencyBonusText: string;
}

export interface PreviewTrait extends PreviewText {
  name: string;
  description: string;
}

export interface PreviewSection {
  key: PreviewSectionKey;
  title: string;
  intro: PreviewText | null;
  items: PreviewTrait[];
  fragmentStart?: number;
  fragmentEnd?: number;
  ariaLabel?: string;
}

export type PreviewSectionKey =
  | "ability"
  | "action"
  | "bonus_action"
  | "reaction"
  | "legendary_action"
  | "villain_action"
  | "mythic_action";

export interface MonsterPreview {
  name: PreviewText;
  meta: PreviewText | null;
  flavor: PreviewText | null;
  armorClass: LabeledPreview;
  hitPoints: LabeledPreview;
  speed: LabeledPreview;
  abilities: AbilityRow[];
  fields: LabeledPreview[];
  challenge: ChallengePreview;
  sections: PreviewSection[];
}

export interface PreviewSectionColumns {
  left: PreviewSection[];
  right: PreviewSection[];
}

const SECTION_TITLES: Record<PreviewSectionKey, string> = {
  ability: "",
  action: "Actions",
  bonus_action: "Bonus Actions",
  reaction: "Reactions",
  legendary_action: "Legendary Actions",
  villain_action: "Villain Actions",
  mythic_action: "Mythic Actions",
};

function text(markdown: string, monster: Monster): PreviewText {
  return { markdown, html: markdownToHtml(markdown, monster) };
}

function field(label: string, value: string, monster: Monster): LabeledPreview {
  const markdown = `**${label}** ${value}`;
  return { label, value, markdown, html: markdownToHtml(markdown, monster) };
}

function joinList(items: string[] | undefined): string {
  if (!items || items.length === 0) return "";
  const output: string[] = [];
  for (const item of items) {
    const value = item.trim();
    if (!value) continue;
    output.push(output.length === 0 ? value : /,/.test(value) ? `; ${value}` : `, ${value}`);
  }
  return output.join("");
}

function languageLine(languages: LanguageEntry[] | undefined, telepathy: number | null): string {
  const parts: string[] = [];
  for (const language of languages ?? []) {
    const name = language.name.trim();
    if (!name) continue;
    if (language.status === "understands") {
      const but = language.but?.trim();
      parts.push(but ? `understands ${name} but ${but}` : `understands ${name}`);
    } else {
      parts.push(name);
    }
  }
  if (telepathy != null) parts.push(`telepathy ${telepathy} ft.`);
  return parts.join(", ");
}

function speedValue(monster: Monster): string {
  return speedList(monster)
    .map((speed) => (speed.label === "walk" ? `${speed.ft} ft.` : `${speed.label} ${speed.ft} ft.`))
    .join(", ");
}

function xpText(xp: number): string {
	return xp.toLocaleString("en-US");
}

export function namePreview(monster: Monster): PreviewText {
	const name = (monster.name ?? "").trim() || "Monster";
	return text(name, monster);
}

export function metaPreview(monster: Monster): PreviewText | null {
  const basics = monster.basics ?? {};
  const type = [basics.type, basics.tag ? `(${basics.tag})` : ""].filter(Boolean).join(" ");
  const creatureType = [basics.size, type].filter(Boolean).join(" ");
  const meta = [creatureType, basics.alignment].filter(Boolean).join(", ");
  return meta ? text(`*${meta}*`, monster) : null;
}

export function flavorPreview(monster: Monster): PreviewText | null {
  const flavor = monster.basics?.flavor?.trim() ?? "";
  return flavor ? text(`*${flavor}*`, monster) : null;
}

export function armorClassPreview(monster: Monster): LabeledPreview {
  const armor = monster.stats?.armor?.trim();
  return field("Armor Class", `${armorClass(monster)}${armor ? ` (${armor})` : ""}`, monster);
}

export function hitPointsPreview(monster: Monster): LabeledPreview {
  const points = hitPoints(monster);
  return field("Hit Points", `${points.hp} (${points.formula})`, monster);
}

export function speedPreview(monster: Monster): LabeledPreview {
  return field("Speed", speedValue(monster), monster);
}

export function abilityRows(monster: Monster): AbilityRow[] {
  const scores = abilityScores(monster);
  const modifiers = abilityMods(monster);
  return ABILITY_KEYS.map((key) => ({
    key,
    label: key.toUpperCase(),
    score: scores[key],
    modifier: modifiers[key],
    modifierText: signed(modifiers[key]),
  }));
}

export function labeledFields(monster: Monster): LabeledPreview[] {
  const saves = monster.proficiencies?.saves ?? [];
  const skills = monster.proficiencies?.skills ?? [];
  const expertise = monster.proficiencies?.expertise ?? [];
  const damageImmunities = sortDefenseValues("damage", monster.proficiencies?.damage_immunities ?? []);
  const damageVulnerabilities = excludeDefenseValues(
    "damage",
    monster.proficiencies?.damage_vulnerabilities ?? [],
    damageImmunities,
  );
  const damageResistances = excludeDefenseValues(
    "damage",
    monster.proficiencies?.damage_resistances ?? [],
    damageImmunities,
  );
  const proficiency = proficiencyFromMonster(monster);
  const modifiers = abilityMods(monster);
  const fields: LabeledPreview[] = [];

  if (saves.length > 0) {
    const value = ABILITY_KEYS.filter((key) => saves.includes(key))
      .map((key) => `${key.toUpperCase()} ${signed(modifiers[key] + proficiency)}`)
      .join(", ");
    fields.push(field("Saving Throws", value, monster));
  }

  if (skills.length > 0 || expertise.length > 0) {
    const values: string[] = [];
    for (const skill of [...new Set([...skills, ...expertise])]) {
      const key = skill.toLowerCase();
      const ability = skillAbility(key);
      const expert = expertise.includes(skill);
      const bonus = modifiers[ability] + (expert ? proficiency * 2 : proficiency);
      values.push(`${skillDisplayName(key)} ${signed(bonus)}${expert ? " (expertise)" : ""}`);
    }
    fields.push(field("Skills", values.join(", "), monster));
  }

  for (const [label, values] of [
    ["Damage Vulnerabilities", damageVulnerabilities],
    ["Damage Resistances", damageResistances],
    ["Damage Immunities", damageImmunities],
    ["Condition Immunities", monster.proficiencies?.condition_immunities],
  ] as const) {
    const value = joinList(values);
    if (value) fields.push(field(label, value, monster));
  }

  const senses = senseList(monster).map((sense) => `${sense.label} ${sense.ft} ft.`);
  senses.push(`passive Perception ${passivePerception(monster)}`);
  fields.push(field("Senses", senses.join(", "), monster));

  const languages = languageLine(monster.language, telepathyFt(monster));
  if (languages) fields.push(field("Languages", languages, monster));
  return fields;
}

export function challengePreview(monster: Monster): ChallengePreview {
	const challenge = crLabel(monster.proficiencies?.challenge);
	const xp = xpForCR(monster.proficiencies?.challenge);
	const proficiencyBonus = proficiencyFromMonster(monster);
	const xpValue = xpText(xp);
  const markdown = `Challenge ${challenge} (${xpValue} XP) **Proficiency Bonus** ${signed(proficiencyBonus)}`;
  return {
    challenge,
    xp,
    xpText: xpValue,
    proficiencyBonus,
    proficiencyBonusText: signed(proficiencyBonus),
    markdown,
    html: markdownToHtml(markdown, monster),
  };
}

function legendaryIntro(monster: Monster): string {
  const name = displayName(monster);
  return `${name} can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. ${name} regains spent legendary actions at the start of its turn.`;
}

function villainIntro(monster: Monster): string {
  return `${displayName(monster)} uses villain actions in place of legendary actions. A villain action can only be taken on the villain's initiative count or as a reaction to a trigger listed in the action. Each villain action can be used once per encounter.`;
}

function mythicIntro(monster: Monster): string {
  const name = displayName(monster);
  return `When ${name} drops to 0 hit points, it can choose to undergo a mythic transformation instead of dying, reclaiming vitality. ${name} regains hit points equal to its hit point maximum, and gains the following mythic actions.`;
}

function sectionIntro(monster: Monster, key: PreviewSectionKey): string | null {
  if (key === "legendary_action") return monster.legendary_description || legendaryIntro(monster);
  if (key === "villain_action") return monster.villain_description || villainIntro(monster);
  if (key === "mythic_action") return monster.mythic_description || mythicIntro(monster);
  return null;
}

function previewTrait(item: ActionItem, monster: Monster): PreviewTrait {
  let name = (item.name ?? "").trim();
  let description = (item.description ?? "").trim();
  const preset = (item.preset ?? "").trim().toLowerCase();
  if (preset && preset !== "none") {
    const generated = presetDescription(item, monster);
    if (generated != null) description = generated;
    if (preset === "legendary_resistance" && !name) name = "Legendary Resistance";
  }
  name = (name + itemSuffix(item)).trim();
  if (name && !/[.!?:]$/.test(name)) name = `${name}.`;
  description = finalizeDescription(description, monster);
  const markdown = name ? `***${name}*** ${description}` : description;
  return { name, description, markdown, html: markdownToHtml(markdown, monster) };
}

function previewSection(monster: Monster, key: PreviewSectionKey, items: ActionItem[]): PreviewSection | null {
  if (items.length === 0) return null;
  const intro = sectionIntro(monster, key);
  return {
    key,
    title: SECTION_TITLES[key],
    intro: intro ? text(finalizeDescription(intro, monster), monster) : null,
    items: items.map((item) => previewTrait(item, monster)),
  };
}

export function sectionPreviews(monster: Monster): PreviewSection[] {
  const sections: PreviewSection[] = [];
  const entries: Array<[PreviewSectionKey, ActionItem[]]> = [
    ["ability", monster.ability ?? []],
    ["action", monster.action ?? []],
    ["bonus_action", monster.bonus_action ?? []],
    ["reaction", monster.reaction ?? []],
  ];
  if (monster.is_legendary) entries.push(["legendary_action", monster.legendary_action ?? []]);
  if (monster.is_villain) entries.push(["villain_action", monster.villain_action ?? []]);
  if (monster.is_mythic && (monster.is_legendary || monster.is_villain)) {
    entries.push(["mythic_action", monster.mythic_action ?? []]);
  }
  for (const [key, items] of entries) {
    const section = previewSection(monster, key, items);
    if (section) sections.push(section);
  }
  return sections;
}

const ESTIMATED_CHARS_PER_LINE = 56;

function estimatedTextWeight(value: PreviewText | null): number {
  if (!value) return 0;
  const lines = value.markdown.split(/\r?\n/).reduce((total, line) => {
    const length = line.trim().length;
    return total + (length === 0 ? 0.5 : Math.max(1, Math.ceil(length / ESTIMATED_CHARS_PER_LINE)));
  }, 0);
  return Math.max(1, lines);
}

function estimatedSectionWeight(section: PreviewSection): number {
  return (
    1 +
    (section.title ? 1.5 : 0) +
    estimatedTextWeight(section.intro) +
    section.items.reduce((total, item) => total + estimatedTextWeight(item), 0)
  );
}

function estimatedSectionItemWeights(section: PreviewSection): number[] {
  const sectionPreludeWeight = 1 + (section.title ? 1.5 : 0) + estimatedTextWeight(section.intro);
  return section.items.map((item, index) => estimatedTextWeight(item) + (index === 0 ? sectionPreludeWeight : 0));
}

function estimatedLeftPreludeWeight(preview: MonsterPreview): number {
  return (
    4 +
    estimatedTextWeight(preview.name) +
    estimatedTextWeight(preview.meta) +
    estimatedTextWeight(preview.flavor) +
    estimatedTextWeight(preview.armorClass) +
    estimatedTextWeight(preview.hitPoints) +
    estimatedTextWeight(preview.speed) +
    2 +
    preview.fields.reduce((total, field) => total + estimatedTextWeight(field), 0) +
    estimatedTextWeight(preview.challenge)
  );
}

interface PreviewSectionUnit {
  sectionIndex: number;
  itemIndex: number | null;
  weight: number;
}

function safeWeight(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value !== undefined && value >= 0 ? value : fallback;
}

function sectionUnits(
  section: PreviewSection,
  sectionIndex: number,
  sectionWeight: number | undefined,
  itemWeights: readonly number[] | undefined,
): PreviewSectionUnit[] {
  if (section.items.length === 0) {
    return [{ sectionIndex, itemIndex: null, weight: safeWeight(sectionWeight, estimatedSectionWeight(section)) }];
  }

  const estimatedItems = estimatedSectionItemWeights(section);
  const estimatedTotal = estimatedItems.reduce((total, weight) => total + weight, 0);
  const measuredItems = itemWeights?.length === section.items.length && itemWeights.every((weight) => Number.isFinite(weight) && weight >= 0)
    ? itemWeights
    : undefined;
  const targetWeight = safeWeight(sectionWeight, estimatedTotal);
  const weights = measuredItems
    ? [...measuredItems]
    : estimatedItems.map((weight) => estimatedTotal > 0 ? weight * targetWeight / estimatedTotal : weight);

  return weights.map((weight, itemIndex) => ({ sectionIndex, itemIndex, weight }));
}

function sectionFragment(section: PreviewSection, start: number, end: number): PreviewSection {
  const fragment = {
    ...section,
    title: start === 0 ? section.title : "",
    intro: start === 0 ? section.intro : null,
    items: section.items.slice(start, end),
  };
  if (start !== 0 || end !== section.items.length) {
    fragment.fragmentStart = start;
    fragment.fragmentEnd = end;
    fragment.ariaLabel = section.title || undefined;
  }
  return fragment;
}

function previewSectionUnits(preview: MonsterPreview): PreviewSectionUnit[] {
  return preview.sections.flatMap((section, sectionIndex) => {
    if (section.items.length === 0) return [{ sectionIndex, itemIndex: null, weight: 1 }];
    return section.items.map<PreviewSectionUnit>((_, itemIndex) => ({ sectionIndex, itemIndex, weight: 1 }));
  });
}

function columnsAtUnitBoundary(
  preview: MonsterPreview,
  units: readonly PreviewSectionUnit[],
  splitIndex: number,
): PreviewSectionColumns {
  const leftUnits = units.slice(0, splitIndex);
  const rightUnits = units.slice(splitIndex);
  const fragments = (selectedUnits: readonly PreviewSectionUnit[]): PreviewSection[] => {
    const output: PreviewSection[] = [];
    let start = 0;
    while (start < selectedUnits.length) {
      const sectionIndex = selectedUnits[start].sectionIndex;
      const section = preview.sections[sectionIndex];
      if (!section) break;
      const firstItem = selectedUnits[start].itemIndex;
      if (firstItem === null) {
        output.push(section);
        start += 1;
        continue;
      }
      let end = start + 1;
      while (end < selectedUnits.length && selectedUnits[end].sectionIndex === sectionIndex) end += 1;
      const lastItem = selectedUnits[end - 1].itemIndex;
      if (lastItem === null) break;
      output.push(sectionFragment(section, firstItem, lastItem + 1));
      start = end;
    }
    return output;
  };

  return { left: fragments(leftUnits), right: fragments(rightUnits) };
}

export function previewSectionUnitCount(preview: MonsterPreview): number {
  return previewSectionUnits(preview).length;
}

export function splitPreviewSectionsAtBoundary(preview: MonsterPreview, splitIndex: number): PreviewSectionColumns {
  const units = previewSectionUnits(preview);
  if (units.length <= 1) return { left: preview.sections, right: [] };
  if (!Number.isInteger(splitIndex) || splitIndex < 1 || splitIndex >= units.length) {
    throw new Error(`Preview section boundary must be between 1 and ${units.length - 1}`);
  }
  return columnsAtUnitBoundary(preview, units, splitIndex);
}

/**
 * Select the closest item boundary. Empty sections remain one indivisible unit,
 * while a populated section carries its heading and intro on its first fragment.
 */
export function splitPreviewSections(preview: MonsterPreview): PreviewSectionColumns {
  return splitPreviewSectionsByWeights(
    preview,
    estimatedLeftPreludeWeight(preview),
    preview.sections.map(estimatedSectionWeight),
    preview.sections.map(estimatedSectionItemWeights),
  );
}

export function splitPreviewSectionsByWeights(
  preview: MonsterPreview,
  preludeWeight: number,
  sectionWeights: readonly number[],
  itemWeights?: readonly (readonly number[] | undefined)[],
): PreviewSectionColumns {
  const safePreludeWeight = safeWeight(preludeWeight, estimatedLeftPreludeWeight(preview));
  const units = preview.sections.flatMap((section, sectionIndex) => sectionUnits(
    section,
    sectionIndex,
    sectionWeights[sectionIndex],
    itemWeights?.[sectionIndex],
  ));
  if (units.length <= 1) return { left: preview.sections, right: [] };

  const totalWeight = safePreludeWeight + units.reduce((total, unit) => total + unit.weight, 0);
  let leftWeight = safePreludeWeight;
  let splitIndex = 1;
  let smallestDifference = Number.POSITIVE_INFINITY;

  for (let index = 1; index < units.length; index += 1) {
    leftWeight += units[index - 1].weight;
    const rightWeight = totalWeight - leftWeight;
    const difference = Math.abs(leftWeight - rightWeight);
    if (difference < smallestDifference) {
      smallestDifference = difference;
      splitIndex = index;
    }
  }

  return columnsAtUnitBoundary(preview, units, splitIndex);
}

function assertPreviewBrowserDom(): void {
  if (typeof window === "undefined" || !window.document) {
    throw new Error("createPreviewModel requires a browser DOM so preview HTML can be sanitized by DOMPurify.");
  }
}

export function createPreviewModel(monster: Monster): MonsterPreview {
  assertPreviewBrowserDom();
  return {
    name: namePreview(monster),
    meta: metaPreview(monster),
    flavor: flavorPreview(monster),
    armorClass: armorClassPreview(monster),
    hitPoints: hitPointsPreview(monster),
    speed: speedPreview(monster),
    abilities: abilityRows(monster),
    fields: labeledFields(monster),
    challenge: challengePreview(monster),
    sections: sectionPreviews(monster),
  };
}

export const previewModel = createPreviewModel;
