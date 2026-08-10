// @ts-expect-error Test runtime provides node:fs; application types intentionally omit Node globals.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createDefaultMonster } from "../../src/lib/monster/defaults";
import { exportMonsterToml, filenameForMonster, importMonsterToml } from "../../src/lib/monster/toml";
import type { ActionItem, LanguageEntry } from "../../src/lib/monster/types";

const fixture = readFileSync("Obsidian-Stat-Blocks/examples/ancient-red-dragon.toml", "utf8");

describe("monster TOML", () => {
  it("imports the complete ancient red dragon fixture", () => {
    const result = importMonsterToml(fixture);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.monster).toMatchObject({
      name: "Ancient Red Dragon",
      shortened_name: "dragon",
      proper_noun: false,
      is_legendary: true,
      basics: { size: "gargantuan", type: "dragon", alignment: "chaotic evil" },
      stats: { base_ac: 22, add_dex: false, max_dex: -1, hit_dice: 28 },
      proficiencies: { saves: ["dex", "con", "wis", "cha"], challenge: 24 },
    });
    expect(result.monster.language).toHaveLength(2);
    expect(result.monster.ability).toHaveLength(1);
    expect(result.monster.action).toHaveLength(6);
    expect(result.monster.bonus_action).toEqual([]);
    expect(result.monster.reaction).toEqual([]);
    expect(result.monster.legendary_action).toHaveLength(3);
    expect(result.monster.villain_action).toEqual([]);
    expect(result.monster.mythic_action).toEqual([]);
  });

  it("round-trips every supported section without losing values", () => {
    const imported = importMonsterToml(fixture);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const roundTrip = importMonsterToml(exportMonsterToml(imported.monster));
    expect(roundTrip.ok).toBe(true);
    if (!roundTrip.ok) return;

    expect(roundTrip.monster).toMatchObject({
      name: imported.monster.name,
      shortened_name: imported.monster.shortened_name,
      basics: imported.monster.basics,
      stats: imported.monster.stats,
      proficiencies: imported.monster.proficiencies,
      language: imported.monster.language,
      ability: imported.monster.ability,
      action: imported.monster.action,
      bonus_action: imported.monster.bonus_action,
      reaction: imported.monster.reaction,
      legendary_action: imported.monster.legendary_action,
      villain_action: imported.monster.villain_action,
      mythic_action: imported.monster.mythic_action,
    });
  });

  it("imports, exports, and warns for damage vulnerabilities", () => {
    const imported = importMonsterToml(`[proficiencies]
damage_vulnerabilities = ["custom vulnerability", "FIRE", "acid", 7, ""]
`);

    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.warnings).toEqual([
      { path: "proficiencies.damage_vulnerabilities[3]", message: "Expected a string; the entry was dropped." },
      { path: "proficiencies.damage_vulnerabilities[4]", message: "Expected a non-empty string; the blank entry was dropped." },
    ]);
    expect(imported.monster.proficiencies?.damage_vulnerabilities).toEqual(["acid", "fire", "custom vulnerability"]);

    const roundTrip = importMonsterToml(exportMonsterToml(imported.monster));
    expect(roundTrip.ok).toBe(true);
    if (roundTrip.ok) {
      expect(roundTrip.warnings).toEqual([]);
      expect(roundTrip.monster.proficiencies?.damage_vulnerabilities).toEqual(["acid", "fire", "custom vulnerability"]);
    }
  });

  it("round-trips a disabled Dexterity modifier without dropping Max Dex", () => {
    const source = createDefaultMonster();
    source.stats = { ...source.stats, add_dex: false, max_dex: 2 };

    const result = importMonsterToml(exportMonsterToml(source));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.monster.stats).toMatchObject({ add_dex: false, max_dex: 2 });
  });

  it("preserves supported challenge forms and safely replaces invalid imports", () => {
    const validValues = ["0", "1/8", "1/4", "1/2", "1", "30"];
    for (const challenge of validValues) {
      const result = importMonsterToml(`[proficiencies]\nchallenge = "${challenge}"`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.monster.proficiencies?.challenge).toBe(challenge);
        expect(result.warnings).toEqual([]);
      }
    }

    for (const challenge of [0, 1, 30]) {
      const result = importMonsterToml(`[proficiencies]\nchallenge = ${challenge}`);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.monster.proficiencies?.challenge).toBe(challenge);
    }

    for (const challenge of ['"bogus"', "-1", "0.125", "31"]) {
      const result = importMonsterToml(`[proficiencies]\nchallenge = ${challenge}`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.monster.proficiencies?.challenge).toBe(0);
        expect(result.warnings).toContainEqual({
          path: "proficiencies.challenge",
          message: "Expected 0, 1/8, 1/4, 1/2, or an integer from 1 through 30; the value was replaced with 0.",
        });
      }
    }
  });

  it("rejects invalid TOML and non-table roots", () => {
    expect(importMonsterToml("name = ")).toMatchObject({ ok: false });
    expect(importMonsterToml("[1, 2, 3]")).toMatchObject({ ok: false });
    expect(importMonsterToml('"scalar"')).toMatchObject({ ok: false });
  });

  it("warns about unsupported keys at every supported nesting level", () => {
    const result = importMonsterToml(`unknown = true

[basics]
extra = "value"

[[action]]
name = "Claw"
extra = "value"
`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.map((warning) => warning.path)).toEqual(["unknown", "basics.extra", "action[0].extra"]);
  });

  it("warns when supported values are invalid or normalized away", () => {
    const result = importMonsterToml(`[basics]
size = "colossal"

[stats]
base_ac = "22"
speed = [30, 0]
ability_scores = [10, 10, 10, 10, 10, 0.5]

[proficiencies]
saves = ["not_an_ability"]
senses = [-1, 30]

[[language]]
name = 42
status = "invalid"

[[action]]
uses = -1
die_count = 0.5
ability = "invalid"
reach = "ten"
`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const paths = result.warnings.map((warning) => warning.path);
    expect(paths).toEqual(expect.arrayContaining([
      "basics.size",
      "stats.base_ac",
      "stats.speed",
      "stats.ability_scores[5]",
      "proficiencies.saves[0]",
      "proficiencies.senses[0]",
      "language[0].name",
      "language[0].status",
      "action[0].name",
      "action[0].uses",
      "action[0].die_count",
      "action[0].ability",
      "action[0].reach",
    ]));
    expect(result.monster.basics?.size).toBe("medium");
    expect(result.monster.stats?.base_ac).toBe(10);
    expect(result.monster.stats?.speed).toHaveLength(5);
    expect(result.monster.language).toEqual([]);
    expect(result.monster.action).toEqual([]);
  });

  it("warns when defense arrays contain blank entries dropped during normalization", () => {
    const result = importMonsterToml(`[proficiencies]
damage_resistances = ["fire", "   ", "\\t", "acid"]
damage_immunities = ["", "cold"]
condition_immunities = ["  "]
`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([
      { path: "proficiencies.damage_resistances[1]", message: "Expected a non-empty string; the blank entry was dropped." },
      { path: "proficiencies.damage_resistances[2]", message: "Expected a non-empty string; the blank entry was dropped." },
      { path: "proficiencies.damage_immunities[0]", message: "Expected a non-empty string; the blank entry was dropped." },
      { path: "proficiencies.condition_immunities[0]", message: "Expected a non-empty string; the blank entry was dropped." },
    ]);
    expect(result.monster.proficiencies?.damage_resistances).toEqual(["acid", "fire"]);
    expect(result.monster.proficiencies?.damage_immunities).toEqual(["cold"]);
    expect(result.monster.proficiencies?.condition_immunities).toEqual([]);
  });

  it("safely clones prototype-named spell data without losing nested values", () => {
    const result = importMonsterToml(`[[action]]
name = "Spellcaster"
spells = [{ "__proto__" = "unsafe", nested = { value = 7 } }]
`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.monster.action?.[0]?.spells).toBeUndefined();
    expect(result.warnings.map((warning) => warning.path)).toContain("action[0].spells");
  });

  it("normalizes nested spell arrays and warns on malformed names and slot values", () => {
    const result = importMonsterToml(`[[action]]
name = "Spellcaster"
preset = "spellcasting"
spells = [["light **bold**"], [4, ["shield"]], [-1, ["fireball"]], [9007199254740992.0, [{ bad = true }]], ["malformed"]]

[[action]]
name = "Innate caster"
preset = "innate_spellcasting"
spells = [[-1, ["detect [magic](url)"]], [-2, ["blur"]], [9007199254740992.0, ["unsafe"]], ["malformed"]]
`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.monster.action?.[0]?.spells).toEqual([
      ["light **bold**"],
      [4, ["shield"]],
      [0, ["fireball"]],
      [0, []],
      [0, []],
      [0, []],
      [0, []],
      [0, []],
      [0, []],
      [0, []],
    ]);
    expect(result.monster.action?.[1]?.spells).toEqual([
      [-1, ["detect [magic](url)"]],
      [0, ["blur"]],
      [0, ["unsafe"]],
    ]);
    expect(result.warnings.map((warning) => warning.path)).toEqual(expect.arrayContaining([
      "action[0].spells[2][0]",
      "action[0].spells[3][0]",
      "action[0].spells[3][1][0]",
      "action[0].spells[4]",
      "action[1].spells[1][0]",
      "action[1].spells[2][0]",
      "action[1].spells[3]",
    ]));
  });

  it("round-trips advanced save and area action fields", () => {
    const imported = importMonsterToml(`[[action]]
name = "Imported save"
preset = "none"
dc_ability = "wis"
save = "dex"
dice = "0"
damage_type_save = "cold"
area = "15-foot cone"
targets = "creatures of choice"
`);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    const roundTrip = importMonsterToml(exportMonsterToml(imported.monster));
    expect(roundTrip.ok).toBe(true);
    if (!roundTrip.ok) return;
    expect(roundTrip.monster.action?.[0]).toMatchObject({ dc_ability: "wis", save: "dex", dice: "0", damage_type_save: "cold", area: "15-foot cone", targets: "creatures of choice" });
  });

  it("omits malformed empty repeatable entries", () => {
    const monster = createDefaultMonster();
    monster.language = [{} as LanguageEntry];
    monster.action = [{} as ActionItem, { name: "Real action" }];

    const exported = exportMonsterToml(monster);
    expect(exported).not.toContain("[[language]]");
    expect(exported.match(/\[\[action\]\]/g)).toHaveLength(1);
    expect(importMonsterToml(exported)).toMatchObject({ ok: true });
  });

  it("slugifies filenames and falls back for blank names", () => {
    expect(filenameForMonster({ name: "Ancient Red Dragon" })).toBe("ancient-red-dragon.toml");
    expect(filenameForMonster({ name: "   " })).toBe("monster.toml");
    expect(filenameForMonster({})).toBe("monster.toml");
  });
});
