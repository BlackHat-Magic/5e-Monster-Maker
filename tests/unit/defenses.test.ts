import { describe, expect, it } from "vitest";
import {
  CONDITION_CANONICAL_VALUES,
  CONDITION_LABELS,
  DAMAGE_CANONICAL_VALUES,
  DAMAGE_LABELS,
  addDefenseValue,
  addImmunity,
  excludeDefenseValues,
  removeDefenseValue,
  sortDefenseValues,
} from "../../src/lib/monster/defenses";
import { createDefaultMonster, normalizeMonster } from "../../src/lib/monster/defaults";
import type { Proficiencies } from "../../src/lib/monster/types";

describe("defense values", () => {
  it("exports canonical damage order and title-case labels", () => {
    expect(DAMAGE_CANONICAL_VALUES).toEqual([
      "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing",
      "poison", "psychic", "radiant", "slashing", "thunder", "nonmagical attacks",
      "nonmagical, non-silvered attacks", "nonmagical, non-adamantine attacks",
    ]);
    expect(DAMAGE_LABELS.fire).toBe("Fire");
    expect(DAMAGE_LABELS["nonmagical, non-silvered attacks"]).toBe("Nonmagical, Non-Silvered Attacks");
  });

  it("places canonical values first and preserves custom values after them", () => {
    expect(sortDefenseValues("damage", ["Custom source", " FIRE ", "acid", "another source"])).toEqual([
      "acid", "fire", "Custom source", "another source",
    ]);
  });

  it("keeps the normalized Monster model in canonical export order", () => {
    const monster = normalizeMonster({
      proficiencies: {
        damage_vulnerabilities: ["custom vulnerability", "LIGHTNING", "acid", " FIRE "],
        damage_resistances: ["custom resistance", "Fire", "acid", "CUSTOM IMMUNITY"],
        damage_immunities: ["Custom immunity", "cold", " FIRE "],
        condition_immunities: ["unconscious", "blinded"],
      },
    });

    expect(monster.proficiencies?.damage_vulnerabilities).toEqual(["acid", "lightning", "custom vulnerability"]);
    expect(monster.proficiencies?.damage_resistances).toEqual(["acid", "custom resistance"]);
    expect(monster.proficiencies?.damage_immunities).toEqual(["cold", "fire", "Custom immunity"]);
    expect(monster.proficiencies?.condition_immunities).toEqual(["blinded", "unconscious"]);
  });

  it("creates a monster with no damage vulnerabilities by default", () => {
    expect(createDefaultMonster().proficiencies?.damage_vulnerabilities).toEqual([]);
  });

  it("trims values and rejects case-insensitive duplicates", () => {
    expect(addDefenseValue("damage", ["Fire", "custom"], " fire ")).toEqual(["fire", "custom"]);
    expect(addDefenseValue("condition", [], "  " )).toEqual([]);
    expect(sortDefenseValues("condition", ["POISONED", " poisoned ", "  "])).toEqual(["poisoned"]);
  });

  it("removes values case-insensitively while keeping unrelated values", () => {
    expect(removeDefenseValue("damage", ["fire", "Cold", "Custom"], " FIRE ")).toEqual(["cold", "Custom"]);
    expect(removeDefenseValue("damage", ["fire"], "")).toEqual(["fire"]);
  });

  it("excludes matching values without changing canonical-first ordering", () => {
    expect(excludeDefenseValues("damage", ["Custom", "LIGHTNING", "cold", "custom immunity"], ["Cold", "CUSTOM IMMUNITY"])).toEqual([
      "lightning", "Custom",
    ]);
  });

  it("exports the canonical condition order and labels", () => {
    expect(CONDITION_CANONICAL_VALUES).toEqual([
      "blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled", "incapacitated",
      "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious",
    ]);
    expect(CONDITION_LABELS.frightened).toBe("Frightened");
    expect(sortDefenseValues("condition", ["unconscious", "blinded", "Custom condition"])).toEqual([
      "blinded", "unconscious", "Custom condition",
    ]);
  });

  it("adds immunity and removes matching vulnerability and resistance", () => {
    const proficiencies: Proficiencies = {
      damage_vulnerabilities: ["fire", "cold", "Custom source"],
      damage_resistances: ["fire", "cold", "Custom source"],
      damage_immunities: [],
    };

    const result = addImmunity(proficiencies, " FIRE ");

    expect(proficiencies.damage_vulnerabilities).toEqual(["fire", "cold", "Custom source"]);
    expect(proficiencies.damage_resistances).toEqual(["fire", "cold", "Custom source"]);
    expect(proficiencies.damage_immunities).toEqual([]);
    expect(result).toEqual({
      damage_vulnerabilities: ["cold", "Custom source"],
      damage_resistances: ["cold", "Custom source"],
      damage_immunities: ["fire"],
    });
  });
});
