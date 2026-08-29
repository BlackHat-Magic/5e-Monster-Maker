import { describe, expect, it } from "vitest";
import { createDefaultMonster, normalizeMonster } from "../../src/lib/monster/defaults";
import { exportMonsterToml, importMonsterToml } from "../../src/lib/monster/toml";

describe("two-column stat block preference", () => {
  it("defaults missing and invalid values to false", () => {
    expect(createDefaultMonster().two_column).toBe(false);
    expect(normalizeMonster({}).two_column).toBe(false);
    expect(normalizeMonster({ two_column: "true" }).two_column).toBe(false);
  });

  it("round-trips a true value through TOML", () => {
    const result = importMonsterToml(exportMonsterToml(normalizeMonster({ two_column: true })));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.monster.two_column).toBe(true);
  });

  it("warns when the TOML value is not boolean", () => {
    const result = importMonsterToml('two_column = "true"');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.monster.two_column).toBe(false);
    expect(result.warnings).toEqual([
      { path: "two_column", message: "Expected a boolean; the value was replaced with the default." },
    ]);
  });
});
