export type SpellLevelDraft = {
  slots: number;
  spells: string[];
};

export type SpellcastingDraft = {
  cantrips: string[];
  levels: SpellLevelDraft[];
};

export type InnateSpellGroupDraft = {
  frequency: number;
  spells: string[];
};

export type SpellWarning = { path: string; message: string };

const SPELL_LEVEL_COUNT = 9;
type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: RecordLike, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function spellName(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function safeSpellNames(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(spellName) : [];
}

function safeSlots(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function safeFrequency(value: unknown): number {
  if (value === -1) return -1;
  return safeSlots(value);
}

function emptySpellcastingDraft(): SpellcastingDraft {
  return {
    cantrips: [],
    levels: Array.from({ length: SPELL_LEVEL_COUNT }, () => ({ slots: 0, spells: [] })),
  };
}

function isSpellcastingObject(value: unknown): value is RecordLike {
  return isRecord(value) && (hasOwn(value, "cantrips") || hasOwn(value, "levels"));
}

export function normalizeSpellcastingSpells(value: unknown): SpellcastingDraft {
  const empty = emptySpellcastingDraft();
  const source = Array.isArray(value)
    ? { cantrips: value[0], levels: value.slice(1) }
    : isSpellcastingObject(value)
      ? value
      : null;
  if (!source) return empty;

  const levels = Array.isArray(source.levels) ? source.levels : [];
  return {
    cantrips: safeSpellNames(source.cantrips),
    levels: Array.from({ length: SPELL_LEVEL_COUNT }, (_, index) => {
      const entry = levels[index];
      if (Array.isArray(entry) && entry.length === 2) {
        return { slots: safeSlots(entry[0]), spells: safeSpellNames(entry[1]) };
      }
      if (isRecord(entry)) {
        return { slots: safeSlots(entry.slots), spells: safeSpellNames(entry.spells) };
      }
      return { ...empty.levels[index] };
    }),
  };
}

export function serializeSpellcastingSpells(value: SpellcastingDraft): unknown[] {
  return [
    [...value.cantrips],
    ...value.levels.slice(0, SPELL_LEVEL_COUNT).map((level) => [safeSlots(level.slots), safeSpellNames(level.spells)]),
  ];
}

export function normalizeInnateSpellGroups(value: unknown): InnateSpellGroupDraft[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (Array.isArray(entry) && entry.length === 2) {
      return [{ frequency: safeFrequency(entry[0]), spells: safeSpellNames(entry[1]) }];
    }
    if (isRecord(entry) && (hasOwn(entry, "frequency") || hasOwn(entry, "spells"))) {
      return [{ frequency: safeFrequency(entry.frequency), spells: safeSpellNames(entry.spells) }];
    }
    return [];
  });
}

export function serializeInnateSpellGroups(value: readonly InnateSpellGroupDraft[]): unknown[] {
  return value.map((group) => [safeFrequency(group.frequency), safeSpellNames(group.spells)]);
}

function warning(warnings: SpellWarning[], path: string, message: string): void {
  warnings.push({ path, message });
}

function warnSpellNames(warnings: SpellWarning[], value: unknown, path: string): void {
  if (!Array.isArray(value)) {
    warning(warnings, path, "Expected an array of spell names; the value was replaced with an empty array.");
    return;
  }
  value.forEach((entry, index) => {
    if (!spellName(entry)) warning(warnings, `${path}[${index}]`, "Expected a non-empty string spell name; the entry was dropped.");
  });
}

function warnSpellcastingLevel(warnings: SpellWarning[], value: unknown, path: string): void {
  if (Array.isArray(value)) {
    if (value.length !== 2) {
      warning(warnings, path, "Expected [slots, spells]; the level was replaced with empty data.");
      return;
    }
    if (!Number.isSafeInteger(value[0]) || (value[0] as number) < 0) {
      warning(warnings, `${path}[0]`, "Expected a non-negative safe integer; the value was replaced with 0.");
    }
    warnSpellNames(warnings, value[1], `${path}[1]`);
    return;
  }
  if (isRecord(value) && (hasOwn(value, "slots") || hasOwn(value, "spells"))) {
    if (!Number.isSafeInteger(value.slots) || (value.slots as number) < 0) {
      warning(warnings, `${path}.slots`, "Expected a non-negative safe integer; the value was replaced with 0.");
    }
    warnSpellNames(warnings, value.spells, `${path}.spells`);
    return;
  }
  warning(warnings, path, "Expected a spell level group; the level was dropped.");
}

function warnSpellcasting(warnings: SpellWarning[], value: unknown, path: string): void {
  if (Array.isArray(value)) {
    if (value.length > SPELL_LEVEL_COUNT + 1) {
      for (let index = SPELL_LEVEL_COUNT + 1; index < value.length; index += 1) {
        warning(warnings, `${path}[${index}]`, "Unsupported spell level group; the entry was dropped.");
      }
    }
    if (value.length > 0) warnSpellNames(warnings, value[0], `${path}[0]`);
    value.slice(1, SPELL_LEVEL_COUNT + 1).forEach((entry, index) => warnSpellcastingLevel(warnings, entry, `${path}[${index + 1}]`));
    return;
  }
  if (isSpellcastingObject(value)) {
    if (hasOwn(value, "cantrips")) warnSpellNames(warnings, value.cantrips, `${path}.cantrips`);
    if (!Array.isArray(value.levels)) {
      warning(warnings, `${path}.levels`, "Expected an array of spell level groups; the value was replaced with empty data.");
      return;
    }
    value.levels.slice(0, SPELL_LEVEL_COUNT).forEach((entry, index) => warnSpellcastingLevel(warnings, entry, `${path}.levels[${index}]`));
    value.levels.slice(SPELL_LEVEL_COUNT).forEach((_, index) => warning(warnings, `${path}.levels[${index + SPELL_LEVEL_COUNT}]`, "Unsupported spell level group; the entry was dropped."));
    return;
  }
  warning(warnings, path, "Expected spellcasting arrays; the value was replaced with empty data.");
}

function warnInnateGroup(warnings: SpellWarning[], value: unknown, path: string): void {
  if (Array.isArray(value)) {
    if (value.length !== 2) {
      warning(warnings, path, "Expected [frequency, spells]; the group was dropped.");
      return;
    }
    if (value[0] !== -1 && (!Number.isSafeInteger(value[0]) || (value[0] as number) < 0)) {
      warning(warnings, `${path}[0]`, "Expected -1 for at will or a non-negative safe integer; the value was replaced with 0.");
    }
    warnSpellNames(warnings, value[1], `${path}[1]`);
    return;
  }
  if (isRecord(value) && (hasOwn(value, "frequency") || hasOwn(value, "spells"))) {
    if (value.frequency !== -1 && (!Number.isSafeInteger(value.frequency) || (value.frequency as number) < 0)) {
      warning(warnings, `${path}.frequency`, "Expected -1 for at will or a non-negative safe integer; the value was replaced with 0.");
    }
    warnSpellNames(warnings, value.spells, `${path}.spells`);
    return;
  }
  warning(warnings, path, "Expected an innate spell group; the entry was dropped.");
}

export function collectSpellWarnings(value: unknown, path: string, schema: "spellcasting" | "innate"): SpellWarning[] {
  const warnings: SpellWarning[] = [];
  if (schema === "spellcasting") warnSpellcasting(warnings, value, path);
  else if (!Array.isArray(value)) warning(warnings, path, "Expected an array of innate spell groups; the value was replaced with empty data.");
  else value.forEach((entry, index) => warnInnateGroup(warnings, entry, `${path}[${index}]`));
  return warnings;
}
