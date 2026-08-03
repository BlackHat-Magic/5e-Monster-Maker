import { describe, expect, it } from "vitest";
import { normalizeMonster } from "../../src/lib/monster/defaults";
import { substitute } from "../../src/lib/monster/templates";
import type { Monster } from "../../src/lib/monster/types";

const dragon: Monster = normalizeMonster({
  name: "Ancient Red Dragon",
  shortened_name: "dragon",
  shortened_plural: "dragons",
  stats: { ability_scores: [30, 10, 29, 18, 15, 23] },
  proficiencies: { challenge: 24 },
});

describe("monster templates", () => {
  it("substitutes names, attacks, saves, and dice", () => {
    expect(substitute("{{MON}} attacks.", dragon)).toBe("The dragon attacks.");
    expect(substitute("{{STR ATK}} to hit", dragon)).toBe("+17 to hit");
    expect(substitute("DC {{WIS SAVE}}", dragon)).toBe("DC 17");
    expect(substitute("{{4D6}} fire", dragon)).toBe("14 (4d6) fire");
    expect(substitute("{{STR 2D10 + 1}}", dragon)).toBe("22 (2d10 + 10 + 1)");
    expect(substitute("{{UNKNOWN}}", dragon)).toBe("{{UNKNOWN}}");
  });

	it("supports lowercase tokens, sentence boundaries, and proper nouns", () => {
    expect(substitute("{{mon}} sees {{mons}}. Next, {{mon}} waits.", dragon)).toBe(
      "The dragon sees dragons. Next, the dragon waits.",
    );
    expect(substitute("{{MONS}} gather.", dragon)).toBe("Dragons gather.");
    expect(
      substitute("{{MON}} follows {{MON}}! {{MON}} follows {{MON}}? {{MON}} follows {{MON}}.", dragon),
    ).toBe("The dragon follows the dragon! The dragon follows the dragon? The dragon follows the dragon.");

    const properNoun = normalizeMonster({
      name: "Mordekainen",
      shortened_name: "Mordekainen",
      shortened_plural: "Mordekainens",
      proper_noun: true,
    });
		expect(substitute("{{MON}} and {{MONS}}", properNoun)).toBe("Mordekainen and Mordekainens");
	});

	it("keeps whitespace-only names from producing blank MON tokens", () => {
		const unnamed = normalizeMonster({ name: " \t", shortened_name: " \n", shortened_plural: "  " });

		expect(substitute("{{MON}}. {{MONS}}.", unnamed)).toBe("The monster. The monsters.");
	});

	it("formats bare and negative modifiers with optional numeric extras", () => {
    const weak = normalizeMonster({
      name: "Weakling",
      shortened_name: "weakling",
      stats: { ability_scores: [8, 12, 7, 10, 10, 10] },
      proficiencies: { challenge: 1 },
    });
    expect(substitute("{{str}}, {{DEX}}, {{con}}", weak)).toBe("-1, +1, -2");
    expect(substitute("{{STR ATK + 2}} / {{CON SAVE - 1}}", weak)).toBe("+3 / 7");
    expect(substitute("{{1D8 - 2}} and {{CON 2D6 - 1}}", weak)).toBe("2 (1d8 -2) and 4 (2d6 - 2 - 1)");
  });

  it("accepts the exact picker forms for bare and ability-damage modifiers", () => {
    expect(substitute("{{3D6 + 1}}", dragon)).toBe("11 (3d6 +1)");
    expect(substitute("{{3D6 - 1}}", dragon)).toBe("9 (3d6 -1)");
    expect(substitute("{{DEX 2D8 + 2}}", dragon)).toBe("11 (2d8 + 2)");
    expect(substitute("{{DEX 2D8 - 2}}", dragon)).toBe("7 (2d8 - 2)");
  });

  it("preserves malformed or unsupported tokens", () => {
    expect(substitute("{{}} {{STR ATK +}} {{1D}} {{STR 2D}} {{MON extra}}", dragon)).toBe(
      "{{}} {{STR ATK +}} {{1D}} {{STR 2D}} {{MON extra}}",
    );
    expect(substitute("Keep {{A.B}} and {{STR ATK + 1.5}}", dragon)).toBe("Keep {{A.B}} and {{STR ATK + 1.5}}");
    expect(substitute("{{0D0}} {{0D6}} {{1D0}} {{999999999999999999999D6}} {{STR 0D0}}", dragon)).toBe(
      "{{0D0}} {{0D6}} {{1D0}} {{999999999999999999999D6}} {{STR 0D0}}",
    );
  });
});
