import { describe, expect, it } from "vitest";
import { createDefaultMonster, normalizeMonster } from "../../src/lib/monster/defaults";
import {
  abilityMod,
  abilityMods,
  abilityScores,
  armorClass,
  attackMod,
  crLabel,
  displayName,
  hitPoints,
  parseCR,
  passivePerception,
  pluralName,
  proficiencyBonus,
  saveDC,
  senseList,
  signed,
  skillAbility,
  skillDisplayName,
  speedList,
  telepathyFt,
  xpForCR,
} from "../../src/lib/monster/calculations";
import type { Monster } from "../../src/lib/monster/types";

const dragon: Monster = normalizeMonster({
  name: "Ancient Red Dragon",
  shortened_name: "dragon",
  stats: {
    base_ac: 22,
    hit_dice: 28,
    speed: [40, 0, 40, 80, 0],
    ability_scores: [30, 10, 29, 18, 15, 23],
  },
  basics: { size: "gargantuan" },
  proficiencies: {
    skills: ["perception", "stealth"],
    expertise: [],
    senses: [60, 120, 0, 0, 0],
    challenge: 24,
  },
});

const saveDc19Fixture = normalizeMonster({
  stats: { ability_scores: [10, 10, 10, 10, 19, 10] },
  proficiencies: { challenge: 24 },
});

const passivePerception25Fixture = normalizeMonster({
  stats: { ability_scores: [10, 10, 10, 10, 13, 10] },
  proficiencies: { challenge: 24, expertise: ["perception"] },
});

describe("monster defaults and normalization", () => {
  it("creates a safe default monster", () => {
    const monster = createDefaultMonster();
    expect(monster.name).toBe("New Monster");
    expect(monster.basics?.size).toBe("medium");
    expect(monster.stats?.base_ac).toBe(10);
    expect(monster.stats?.hit_dice).toBe(1);
    expect(monster.stats?.speed?.[0]).toBe(30);
    expect(monster.stats?.ability_scores).toEqual([10, 10, 10, 10, 10, 10]);
    expect(monster.proficiencies?.challenge).toBe(0);
    expect(speedList(monster)).toEqual([{ label: "walk", ft: 30 }]);
  });

  it("fills arrays, preserves zeroes, filters repeatable entries, and does not mutate input", () => {
    const input = {
      name: "Zero",
      stats: { base_ac: 0, hit_dice: 0, speed: [0, 0], ability_scores: [0] },
      proficiencies: { challenge: 0, senses: [0, 0, 0, 0, 0] },
      action: [{ name: "Valid" }, null, "invalid"],
      language: [null, { name: "Common", status: "speaks" }],
    };
    const snapshot = structuredClone(input);
    const normalized = normalizeMonster(input);

    expect(normalized.stats?.base_ac).toBe(0);
    expect(normalized.stats?.hit_dice).toBe(0);
    expect(normalized.stats?.ability_scores?.[0]).toBe(0);
    expect(normalized.proficiencies?.challenge).toBe(0);
    expect(normalized.action).toEqual([{ name: "Valid" }]);
    expect(normalized.language).toEqual([{ name: "Common", status: "speaks" }]);
    expect(input).toEqual(snapshot);
  });

  it("field-normalizes repeatables and rejects malformed numeric, enum, and size values", () => {
    const normalized = normalizeMonster({
      basics: { size: "colossal" },
      stats: {
        max_dex: -1,
        hit_dice: -2.5,
        speed: [-1, 15.5, 20, Number.POSITIVE_INFINITY, 30],
        ability_scores: [-1, 10.5, 12, Number.POSITIVE_INFINITY, 0, 18],
      },
      proficiencies: {
        saves: ["str", "not-an-ability"],
        skills: ["perception", "str", "not-a-skill"],
        expertise: ["perception", "dex", "not-a-skill"],
        senses: [-1, 15.5, "30", "not-a-distance", "-10"],
      },
      action: [
        { name: 42, description: {} },
        {
          name: "Filtered fields",
          description: {},
          uses: -1,
          reach: -1.5,
          short_range: 30.5,
          long_range: 20,
          die_count: -2,
          die_size: 0,
          recharge_min: -1,
          recharge_max: 2,
          cost: "1",
          initiative: 4,
          preset: "unknown",
          ability: "not-an-ability",
        },
        {
          name: "Valid zeroes",
          uses: 0,
          reach: 0,
          cost: 0,
          initiative: "surprise",
          ability: "str",
          preset: "attack",
        },
      ],
      language: [
        { name: 42, status: "speaks" },
        { name: "Common", status: "invalid", but: {} },
        { name: "Draconic", status: "speaks", but: 42 },
        { name: "Elvish", status: "understands", but: "only a little" },
      ],
    });

    expect(normalized.basics?.size).toBe("medium");
    expect(normalized.stats).toMatchObject({
      max_dex: -1,
      hit_dice: 1,
      speed: [30, 0, 20, 0, 30],
      ability_scores: [10, 10, 12, 10, 0, 18],
    });
    expect(normalized.proficiencies).toMatchObject({
      saves: ["str"],
      skills: ["perception"],
      expertise: ["perception"],
      senses: [0, 0, "30", 0, 0],
    });
    expect(normalized.action).toEqual([
      {
        name: "Filtered fields",
        long_range: 20,
        recharge_max: 2,
        cost: "1",
        initiative: 4,
      },
      {
        name: "Valid zeroes",
        uses: 0,
        reach: 0,
        cost: 0,
        initiative: "surprise",
        ability: "str",
        preset: "attack",
      },
    ]);
    expect(normalized.language).toEqual([
      { name: "Draconic", status: "speaks" },
      { name: "Elvish", status: "understands", but: "only a little" },
    ]);
  });
});

describe("monster calculations", () => {
  it("calculates the Ancient Red Dragon values", () => {
    expect(abilityMod(30)).toBe(10);
    expect(proficiencyBonus(24)).toBe(7);
    expect(armorClass(dragon)).toBe(22);
    expect(hitPoints(dragon)).toEqual({ hp: 546, formula: "28d20 + 252" });
    expect(saveDC(dragon, "wis")).toBe(17);
    expect(attackMod(dragon, "str")).toBe(17);
    expect(passivePerception(dragon)).toBe(19);
  });

  it("covers higher save DC and expertise perception values", () => {
    expect(saveDC(saveDc19Fixture, "wis")).toBe(19);
    expect(passivePerception(passivePerception25Fixture)).toBe(25);
  });

  it("parses and labels the supported challenge ratings", () => {
    expect(parseCR(0)).toBe(0);
    expect(parseCR("1")).toBe(1);
    expect(parseCR("8")).toBe(8);
    expect(parseCR("1/4")).toBe(0.25);
    expect(parseCR("1/2")).toBe(0.5);
    expect(crLabel(0)).toBe("0");
    expect(crLabel(1)).toBe("1");
    expect(crLabel("1/8")).toBe("1/8");
    expect(crLabel("1/4")).toBe("1/4");
    expect(crLabel("1/2")).toBe("1/2");
    expect(xpForCR(0)).toBe(10);
    expect(xpForCR("1/4")).toBe(50);
    expect(xpForCR(24)).toBe(62000);
  });

  it("handles signed values, scores, skills, and negative Constitution", () => {
    const monster = normalizeMonster({ stats: { ability_scores: [8, 12, 7, 10, 10, 10] } });
    expect(signed(3)).toBe("+3");
    expect(signed(-2)).toBe("-2");
    expect(abilityScores(monster)).toEqual({ str: 8, dex: 12, con: 7, int: 10, wis: 10, cha: 10 });
    expect(abilityMods(monster)).toEqual({ str: -1, dex: 1, con: -2, int: 0, wis: 0, cha: 0 });
    expect(hitPoints(normalizeMonster({ stats: { hit_dice: 2, ability_scores: [10, 10, 7, 10, 10, 10] } }))).toEqual({
      hp: 5,
      formula: "2d8 - 4",
    });
    expect(skillAbility("animal_handling")).toBe("wis");
    expect(skillDisplayName("sleight_of_hand")).toBe("Sleight of Hand");
  });

  it("adds Dexterity to armor class with an optional cap", () => {
    const monster = normalizeMonster({
      stats: { base_ac: 12, add_dex: true, max_dex: 2, ability_scores: [10, 20, 10, 10, 10, 10] },
    });
    expect(armorClass(monster)).toBe(14);
    expect(armorClass(normalizeMonster({ ...monster, stats: { ...monster.stats, max_dex: 0 } }))).toBe(12);
    expect(armorClass(normalizeMonster({ ...monster, stats: { ...monster.stats, max_dex: -1 } }))).toBe(17);
  });

  it("omits zero special speeds and senses, and separates telepathy", () => {
    expect(speedList(dragon)).toEqual([
      { label: "walk", ft: 40 },
      { label: "climb", ft: 40 },
      { label: "fly", ft: 80 },
    ]);
    expect(senseList(dragon)).toEqual([
      { label: "blindsight", ft: 60 },
      { label: "darkvision", ft: 120 },
    ]);
    expect(telepathyFt(dragon)).toBeNull();
    expect(telepathyFt(normalizeMonster({ proficiencies: { senses: [0, 0, 0, 0, 30] } }))).toBe(30);
  });

  it("formats singular and plural names", () => {
    expect(displayName(dragon)).toBe("the dragon");
		expect(displayName(normalizeMonster({ name: "Mordekainen", shortened_name: "Mordekainen", proper_noun: true }))).toBe("Mordekainen");
		expect(displayName(normalizeMonster({ name: "The Lich", shortened_name: "The lich" }))).toBe("The lich");
		expect(displayName(normalizeMonster({ name: "  ", shortened_name: " \t" }))).toBe("the monster");
		expect(displayName(normalizeMonster({ name: "Ancient Red Dragon", shortened_name: " dragon " }))).toBe("the dragon");
		expect(pluralName(normalizeMonster({ name: "Ancient Red Dragon", shortened_plural: "dragons" }))).toBe("dragons");
		expect(pluralName(normalizeMonster({ name: "New Monster" }))).toBe("New Monster");
		expect(pluralName(normalizeMonster({ name: "  ", shortened_plural: " \n" }))).toBe("the monsters");
		expect(pluralName(normalizeMonster({ name: "Ancient Red Dragon", shortened_plural: " dragons " }))).toBe("dragons");
	});
});
