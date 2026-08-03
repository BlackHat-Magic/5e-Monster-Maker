import { describe, expect, it } from "vitest";
import { normalizeMonster } from "../../src/lib/monster/defaults";
import { finalizeDescription, itemSuffix, presetDescription } from "../../src/lib/monster/presets";
import type { ActionItem, Monster } from "../../src/lib/monster/types";

const dragon: Monster = normalizeMonster({
  name: "Ancient Red Dragon",
  shortened_name: "dragon",
  shortened_plural: "dragons",
  stats: { ability_scores: [30, 10, 29, 18, 15, 23] },
  proficiencies: { challenge: 24 },
});

describe("monster presets", () => {
  it("formats attack presets and finalizes their tokens", () => {
    const attack: ActionItem = {
      name: "Claw",
      preset: "attack",
      reach: 10,
      ability: "str",
      die_count: 2,
      die_size: 6,
      damage_type: "slashing",
    };
    const generated = presetDescription(attack, dragon);
    expect(generated).toBe(
      "*Melee Weapon Attack:* {{STR ATK}} to hit, reach 10 ft., one target. *Hit:* {{STR 2D6}} slashing damage.",
    );
    expect(finalizeDescription(generated ?? "", dragon)).toBe(
      "*Melee Weapon Attack:* +17 to hit, reach 10 ft., one target. *Hit:* 17 (2d6 + 10) slashing damage.",
    );
  });

  it("keeps ranged attack bounds defined when data is complete or incomplete", () => {
    const complete = presetDescription(
      { name: "Bite", preset: "attack", short_range: 30, long_range: 120, damage_type: "piercing" },
      dragon,
    );
    expect(complete).toContain("Ranged Weapon Attack");
    expect(complete).toContain("range 30/120 ft.");
    expect(complete).not.toContain("undefined");

    const shortOnly = presetDescription({ name: "Bite", preset: "attack", short_range: 30 }, dragon);
    expect(shortOnly).toContain("range 30 ft.");
    expect(shortOnly).not.toContain("undefined");

    const longOnly = presetDescription({ name: "Bite", preset: "attack", long_range: 120 }, dragon);
    expect(longOnly).toContain("range 120 ft.");
    expect(longOnly).not.toContain("undefined");
  });

  it("keeps an empty attack preset grammatically valid", () => {
    const incomplete = presetDescription({ name: "Attack", preset: "attack" }, dragon);
    expect(incomplete).toBe(
      "*Melee Weapon Attack:* {{STR ATK}} to hit, one target. *Hit:* {{STR 1D6}} damage.",
    );
    expect(incomplete).not.toContain("undefined");
    expect(incomplete).not.toContain("damage damage");
    expect(incomplete).not.toContain(", ,");
    expect(incomplete).not.toContain("to hit, ,");
  });

  it("formats legendary resistance and fallback presets", () => {
    expect(presetDescription({ name: "", preset: "legendary_resistance" }, dragon)).toBe(
      "If the dragon fails a saving throw, it can choose to succeed instead.",
    );
    expect(presetDescription({ name: "Custom", preset: "none", description: "Keep me" }, dragon)).toBeNull();
    expect(presetDescription({ name: "Custom", preset: "unknown" as "" }, dragon)).toBeNull();
    expect(finalizeDescription("{{MON}} remains.", dragon)).toBe("The dragon remains.");
  });

  it("follows display-name article and proper-noun rules", () => {
    expect(presetDescription({ name: "", preset: "legendary_resistance" }, normalizeMonster({ name: "The Dragon", shortened_name: "the dragon" }))).toBe(
      "If the dragon fails a saving throw, it can choose to succeed instead.",
    );
    expect(presetDescription({ name: "", preset: "legendary_resistance" }, normalizeMonster({ name: "Tiamat", shortened_name: "Tiamat", proper_noun: true }))).toBe(
      "If Tiamat fails a saving throw, it can choose to succeed instead.",
    );
    expect(presetDescription({ name: "", preset: "legendary_resistance" }, normalizeMonster({ name: "Ancient Red Dragon" }))).toBe(
      "If Ancient Red Dragon fails a saving throw, it can choose to succeed instead.",
    );
  });

  it("formats prepared spell lists, links, and ordinal levels", () => {
    const spellcasting: ActionItem = {
      name: "Spellcasting",
      preset: "spellcasting",
      ability: "wis",
      level: 9,
      class: "wizard",
      spells: [
        ["light", "[Magic Missile](https://example.test/magic-missile)", "`ray of frost`"],
        [4, ["shield", "Misty Step"]],
        [3, ["fireball"]],
      ],
    };
    expect(presetDescription(spellcasting, dragon)).toBe(
      "The dragon is a 9-level spellcaster. Its spellcasting ability is Wisdom (spell save DC {{WIS SAVE}}, {{WIS ATK}} to hit with spell attacks). The dragon has the following wizard spells prepared:\n\n- Cantrips (at will): *light*, [Magic Missile](https://example.test/magic-missile), `ray of frost`\n- 1st level (4 slots): *shield*, *Misty Step*\n- 2nd level (3 slots): *fireball*",
    );
  });

  it("defaults unset spellcasting abilities to Wisdom", () => {
    expect(presetDescription({ name: "Spellcasting", preset: "spellcasting" }, dragon)).toContain(
      "spellcasting ability is Wisdom",
    );
    expect(presetDescription({ name: "Innate", preset: "innate_spellcasting" }, dragon)).toContain(
      "innate spellcasting ability is Wisdom",
    );
  });

  it("formats innate spellcasting groups and item suffixes", () => {
    const innate: ActionItem = {
      name: "Innate Spellcasting",
      preset: "innate_spellcasting",
      ability: "cha",
      spells: [
        [-1, ["detect magic", "[darkness](url)"]],
        [3, ["fireball"]],
      ],
    };
    expect(presetDescription(innate, dragon)).toBe(
      "The dragon's innate spellcasting ability is Charisma (spell save DC {{CHA SAVE}}, {{CHA ATK}} to hit with spell attacks). The dragon can innately cast the following spells, requiring no material components:\n\n- At will: *detect magic*, [darkness](url)\n- 3/day each: *fireball*",
    );
    expect(itemSuffix({ name: "Roar", uses: 3, interval: "Day" })).toBe(" (3/Day)");
    expect(itemSuffix({ name: "Breath", recharge_min: 5, recharge_max: 6 })).toBe(" (Recharge 5\u20136)");
    expect(itemSuffix({ name: "Breath", recharge_min: 5 })).toBe(" (Recharge 5\u20136)");
    expect(itemSuffix({ name: "Breath", recharge_min: 5, recharge_max: 5 })).toBe(" (Recharge 5\u20136)");
  });
});
