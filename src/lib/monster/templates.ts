import type { AbilityKey, Monster } from "./types";
import {
  abilityMods,
  attackMod,
  diceAverage,
  displayName,
  pluralName,
  saveDC,
  signed,
} from "./calculations";

const ABILITY_RE = "(?:STR|DEX|CON|INT|WIS|CHA)";
const TOKEN_RE = /\{\{([^{}]*)\}\}/g;

function parseExtra(value: string): { value: number; raw: string } {
  if (!value) return { value: 0, raw: "" };
  const match = value.match(/^\s*([+-])\s*(\d+)\s*$/);
  if (!match) return { value: 0, raw: "" };

  const number = Number(match[2]);
  return {
    value: match[1] === "-" ? -number : number,
    raw: `${match[1] === "-" ? "-" : "+"}${number}`,
  };
}

function signedTail(value: number): string {
  return value > 0 ? ` + ${value}` : value < 0 ? ` - ${Math.abs(value)}` : "";
}

function positiveSafeInteger(value: string): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

interface Token {
  apply(monster: Monster): string;
}

function parseToken(inner: string): Token | null {
  const token = inner.trim();
  if (!token) return null;

  if (/^MON$/i.test(token)) return { apply: displayName };
  if (/^MONS$/i.test(token)) return { apply: pluralName };

  let match = token.match(new RegExp(`^(${ABILITY_RE})\\s+ATK(\\s*[+-]\\s*\\d+)?$`, "i"));
  if (match) {
    const ability = match[1].toLowerCase() as AbilityKey;
    const extra = parseExtra(match[2] ?? "");
    return { apply: (monster) => signed(attackMod(monster, ability) + extra.value) };
  }

  match = token.match(new RegExp(`^(${ABILITY_RE})\\s+SAVE(\\s*[+-]\\s*\\d+)?$`, "i"));
  if (match) {
    const ability = match[1].toLowerCase() as AbilityKey;
    const extra = parseExtra(match[2] ?? "");
    return { apply: (monster) => String(saveDC(monster, ability) + extra.value) };
  }

  match = token.match(new RegExp(`^(${ABILITY_RE})\\s+(\\d+)D(\\d+)(\\s*[+-]\\s*\\d+)?$`, "i"));
  if (match) {
    const ability = match[1].toLowerCase() as AbilityKey;
    const count = positiveSafeInteger(match[2]);
    const die = positiveSafeInteger(match[3]);
    if (count == null || die == null) return null;
    const extra = parseExtra(match[4] ?? "");
    return {
      apply: (monster) => {
        const abilityModifier = abilityMods(monster)[ability];
        const total = diceAverage(count, die) + abilityModifier + extra.value;
        const extraTail = extra.raw ? ` ${extra.raw[0]} ${extra.raw.slice(1)}` : "";
        const tail = signedTail(abilityModifier) + extraTail;
        return `${total} (${count}d${die}${tail})`;
      },
    };
  }

  match = token.match(new RegExp(`^(${ABILITY_RE})$`, "i"));
  if (match) {
    const ability = match[1].toLowerCase() as AbilityKey;
    return { apply: (monster) => signed(abilityMods(monster)[ability]) };
  }

  match = token.match(/^(\d+)D(\d+)(\s*[+-]\s*\d+)?$/i);
  if (match) {
    const count = positiveSafeInteger(match[1]);
    const die = positiveSafeInteger(match[2]);
    if (count == null || die == null) return null;
    const extra = parseExtra(match[3] ?? "");
    return {
      apply: () => `${diceAverage(count, die) + extra.value} (${count}d${die}${extra.raw ? ` ${extra.raw}` : ""})`,
    };
  }

  return null;
}

function isSentenceStart(text: string, offset: number): boolean {
  return /(?:^|[.!?]\s+|\n\s*)$/.test(text.slice(0, offset));
}

function capitalizeFirst(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

/** Substitute documented {{...}} monster tokens, preserving unknown tokens. */
export function substitute(text: string, monster: Monster): string {
  if (!text) return text;

  return text.replace(TOKEN_RE, (whole, inner: string, offset: number, source: string) => {
    const token = parseToken(inner);
    if (!token) return whole;
    const value = token.apply(monster);
    return isSentenceStart(source, offset) ? capitalizeFirst(value) : value;
  });
}
