import type { AbilityKey, ActionItem, Monster } from "./types";
import { displayName } from "./calculations";
import { substitute } from "./templates";

function ordinal(value: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const remainder = value % 100;
  return value + (suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0]);
}

function italicSpell(name: unknown): string {
  const value = String(name ?? "").trim();
  if (!value) return "";
  if (/[\[*_`]/.test(value)) return value;
  return `*${value}*`;
}

function spellList(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map(italicSpell).filter(Boolean).join(", ");
}

/** Return the uses or recharge suffix appended to an action name. */
export function itemSuffix(item: ActionItem): string {
  if (item.uses != null && item.interval) return ` (${item.uses}/${item.interval})`;
  if (item.recharge_min != null) {
    const max = item.recharge_max;
    if (max != null && max !== item.recharge_min) return ` (Recharge ${item.recharge_min}\u2013${max})`;
    return ` (Recharge ${item.recharge_min}\u20136)`;
  }
  return "";
}

function abilityLong(ability: AbilityKey): string {
  return {
    str: "Strength",
    dex: "Dexterity",
    con: "Constitution",
    int: "Intelligence",
    wis: "Wisdom",
    cha: "Charisma",
  }[ability];
}

function normalizeAbility(value: string | undefined): AbilityKey {
  const ability = (value ?? "").toLowerCase().trim();
  return ["str", "dex", "con", "int", "wis", "cha"].includes(ability) ? (ability as AbilityKey) : "wis";
}

function subject(monster: Monster, capitalize = false): string {
  const phrase = displayName(monster);
  return capitalize ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : phrase;
}

/** Synthesize the markdown description for a supported preset. */
export function presetDescription(item: ActionItem, monster: Monster): string | null {
  const preset = (item.preset ?? "").trim().toLowerCase();
  if (!preset || preset === "none") return null;

  switch (preset) {
    case "attack": {
      const hasMelee = item.reach != null;
      const hasShortRange = item.short_range != null;
      const hasLongRange = item.long_range != null;
      const hasRanged = hasShortRange || hasLongRange;
      const kind = hasMelee && hasRanged ? "Melee or Ranged" : hasRanged ? "Ranged" : "Melee";
      const ability = item.ability ?? (hasRanged && !hasMelee ? "dex" : "str");
      const abilityUpper = ability.toUpperCase();
      const reach = hasMelee ? `reach ${item.reach} ft.` : "";
      const range = hasShortRange && hasLongRange
        ? `range ${item.short_range}/${item.long_range} ft.`
        : hasShortRange
          ? `range ${item.short_range} ft.`
          : hasLongRange
            ? `range ${item.long_range} ft.`
            : "";
      const where = hasMelee && hasRanged ? `${reach} or ${range}` : reach || range;
      const dice = `${item.die_count ?? 1}D${item.die_size ?? 6}`;
      const damageType = item.damage_type?.trim();
      const damage = damageType ? `${damageType} damage` : "damage";
      const location = where ? `, ${where}` : "";
      return `*${kind} Weapon Attack:* {{${abilityUpper} ATK}} to hit${location}, one target. *Hit:* {{${abilityUpper} ${dice}}} ${damage}.`;
    }
    case "legendary_resistance":
      return `If ${subject(monster)} fails a saving throw, it can choose to succeed instead.`;
    case "spellcasting": {
      const ability = normalizeAbility(item.ability as string | undefined);
      const abilityUpper = ability.toUpperCase();
      const level = item.level ?? 1;
      const className = item.class ?? "";
      const lines = [
        `${subject(monster, true)} is a ${level}-level spellcaster. Its spellcasting ability is ${abilityLong(ability)} (spell save DC {{${abilityUpper} SAVE}}, {{${abilityUpper} ATK}} to hit with spell attacks). ${subject(monster, true)} has the following ${className} spells prepared:`,
        "",
      ];
      if (Array.isArray(item.spells)) {
        const cantrips = item.spells[0];
        if (Array.isArray(cantrips) && cantrips.length) lines.push(`- Cantrips (at will): ${spellList(cantrips)}`);
        for (let levelNumber = 1; levelNumber <= 9; levelNumber++) {
          const entry = item.spells[levelNumber];
          if (!Array.isArray(entry) || entry.length < 2) continue;
          const prepared = entry[1];
          if (!Array.isArray(prepared) || prepared.length === 0) continue;
          lines.push(`- ${ordinal(levelNumber)} level (${entry[0]} slots): ${spellList(prepared)}`);
        }
      }
      return lines.join("\n");
    }
    case "innate_spellcasting": {
      const ability = normalizeAbility(item.ability as string | undefined);
      const abilityUpper = ability.toUpperCase();
      const lines = [
        `${subject(monster, true)}'s innate spellcasting ability is ${abilityLong(ability)} (spell save DC {{${abilityUpper} SAVE}}, {{${abilityUpper} ATK}} to hit with spell attacks). ${subject(monster, true)} can innately cast the following spells, requiring no material components:`,
        "",
      ];
      if (Array.isArray(item.spells)) {
        for (const group of item.spells) {
          if (!Array.isArray(group) || group.length < 2) continue;
          const names = group[1];
          if (!Array.isArray(names) || names.length === 0) continue;
           const label = group[0] === -1 ? "At will" : `${group[0]}/day each`;
          lines.push(`- ${label}: ${spellList(names)}`);
        }
      }
      return lines.join("\n");
    }
    default:
      return null;
  }
}

/** Substitute tokens in a generated or user-authored description. */
export function finalizeDescription(description: string, monster: Monster): string {
  return substitute(description, monster);
}
