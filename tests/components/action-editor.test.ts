import { describe, expect, it } from "vitest";
import { createDefaultMonster } from "../../src/lib/monster/defaults";
import { presetDescription } from "../../src/lib/monster/presets";
import {
  ACTION_ARRAY_KEYS,
  createDefaultAction,
  insertTokenAtSelection,
  normalizeInnateSpellGroups,
  parseIntegerAtLeast,
  parseNonNegativeInteger,
  parseNumberOrString,
  parsePositiveInteger,
  presetFieldGroup,
  normalizeSpellcastingSpells,
  serializeInnateSpellGroups,
  serializeSpellcastingSpells,
  switchActionPreset,
  tokenPickerKeyAction,
  TOKEN_GROUPS,
  updateIntroDescription,
  updateActionArray,
} from "../../src/lib/components/editor/action-editor-core";
import { appendRepeatableKey, createRepeatableKeyState, moveListItem, removeListItem, repeatableFocusTarget, syncRepeatableKeys } from "../../src/lib/components/editor/editor-core";
import type { ActionItem } from "../../src/lib/monster/types";

describe("action editor helpers", () => {
  it("creates a default none action and adds it immutably to the target array", () => {
    const monster = createDefaultMonster();
    const action = createDefaultAction();
    const updated = updateActionArray(monster, "reaction", [action]);

    expect(action).toEqual({ name: "", preset: "none", description: "" });
    expect(updated.reaction).toEqual([action]);
    expect(monster.reaction).toEqual([]);
  });

  it("removes and reorders only the selected target array", () => {
    const monster = updateActionArray(createDefaultMonster(), "legendary_action", [
      { name: "First" },
      { name: "Second" },
      { name: "Third" },
    ]);
    const reordered = { ...monster, legendary_action: moveListItem(monster.legendary_action ?? [], 2, 0) };
    const removed = { ...reordered, legendary_action: removeListItem(reordered.legendary_action ?? [], 1) };

    expect(reordered.legendary_action?.map((item) => item.name)).toEqual(["Third", "First", "Second"]);
    expect(removed.legendary_action?.map((item) => item.name)).toEqual(["Third", "Second"]);
    expect(monster.action).toEqual([]);
    expect(monster.legendary_action?.map((item) => item.name)).toEqual(["First", "Second", "Third"]);
  });

  it("switches presets without deleting name, description, or valid fields", () => {
    const action = { name: "Arcane bolt", description: "Keep this source text.", reach: 10, die_count: 2, preset: "attack" as const };

    expect(switchActionPreset(action, "spellcasting")).toEqual({
      ...action,
      preset: "spellcasting",
      spells: [[], [0, []], [0, []], [0, []], [0, []], [0, []], [0, []], [0, []], [0, []], [0, []]],
    });
    expect(switchActionPreset(action, "none")).toMatchObject({ name: action.name, description: action.description, reach: 10 });
  });

  it("round-trips nested spellcasting levels and innate spell groups", () => {
    const spellcasting = normalizeSpellcastingSpells([
      ["light"],
      [4, ["shield"]],
      [0, []],
      ["", ["fireball"]],
    ]);
    const spellcastingRoundTrip = serializeSpellcastingSpells(spellcasting);
    const innate = normalizeInnateSpellGroups([[-1, ["detect magic"]], [3, ["fireball"]]]);

    expect(spellcasting.cantrips).toEqual(["light"]);
    expect(spellcasting.levels[0]).toEqual({ slots: 4, spells: ["shield"] });
    expect(spellcasting.levels[2]).toEqual({ slots: 0, spells: ["fireball"] });
    expect(spellcastingRoundTrip[1]).toEqual([4, ["shield"]]);
    expect(innate).toEqual([
      { frequency: -1, spells: ["detect magic"] },
      { frequency: 3, spells: ["fireball"] },
    ]);
    expect(serializeInnateSpellGroups(innate)).toEqual([[-1, ["detect magic"]], [3, ["fireball"]]]);
  });

  it("renders safe attack descriptions for melee, ranged, and incomplete data", () => {
    const monster = createDefaultMonster();
    for (const action of [
      { name: "Melee", preset: "attack" as const, reach: 5 },
      { name: "Ranged", preset: "attack" as const, short_range: 30, long_range: 120 },
      { name: "Incomplete", preset: "attack" as const },
    ]) {
      const description = presetDescription(action, monster) ?? "";
      expect(description).not.toContain("undefined");
      expect(description).not.toContain("damage damage");
    }
  });

  it("exposes attack and spellcasting field data through the preset model", () => {
    expect(presetDescription({ name: "Claw", preset: "attack", reach: 5, die_count: 2, die_size: 8, damage_type: "slashing" }, createDefaultMonster())).toContain("reach 5 ft.");
    expect(presetDescription({ name: "Spells", preset: "spellcasting", ability: "int", level: 7, class: "wizard", spells: [[], [3, ["shield"]]] }, createDefaultMonster())).toContain("7-level spellcaster");
  });

  it("inserts exact tokens at a caret or replaces a selected range", () => {
    expect(insertTokenAtSelection("Strike here.", 7, 7, "STR ATK")).toEqual({ value: "Strike {{STR ATK}}here.", caret: 18 });
    expect(insertTokenAtSelection("Use old text.", 4, 7, "MON")).toEqual({ value: "Use {{MON}} text.", caret: 11 });
  });

  it("offers exact signed bare-dice and ability-damage token forms", () => {
    const bareDice = TOKEN_GROUPS.find((group) => group.id === "bare-dice")?.options.map((option) => option.token) ?? [];
    const abilityDamage = TOKEN_GROUPS.find((group) => group.id === "ability-damage")?.options.map((option) => option.token) ?? [];

    expect(bareDice).toEqual(expect.arrayContaining(["3D6", "3D6 + 1", "3D6 - 1"]));
    expect(abilityDamage).toEqual(expect.arrayContaining(["DEX 2D8", "DEX 2D8 + 2", "DEX 2D8 - 2"]));
    expect(["3D6 + 1", "3D6 - 1", "DEX 2D8 + 2", "DEX 2D8 - 2"].map((token) => `{{${token}}}`)).toEqual([
      "{{3D6 + 1}}",
      "{{3D6 - 1}}",
      "{{DEX 2D8 + 2}}",
      "{{DEX 2D8 - 2}}",
    ]);
  });

  it("covers every token category with valid brace syntax", () => {
    expect(TOKEN_GROUPS).toHaveLength(7);
    expect(TOKEN_GROUPS.map((group) => group.id)).toEqual([
      "names",
      "ability-modifiers",
      "ability-attacks",
      "ability-saves",
      "bare-dice",
      "ability-damage",
      "numeric-modifiers",
    ]);
    for (const group of TOKEN_GROUPS) {
      expect(group.options.length).toBeGreaterThan(0);
      for (const option of group.options) expect(`{{${option.token}}}`).toMatch(/^\{\{[^{}]+\}\}$/);
    }
  });

  it("maps add, reorder, remove, and all seven target section operations", () => {
    let items: ActionItem[] = [{ name: "First", description: "Keep first" }, { name: "Second", description: "Keep second" }];
    items = [...items, createDefaultAction()];
    items[2] = { ...items[2], name: "Third" };
    items = moveListItem(items, 2, 1);
    items = removeListItem(items, 0);

    expect(items.map((item) => item.name)).toEqual(["Third", "Second"]);
    expect(items[0].description).toBe("");
    expect(ACTION_ARRAY_KEYS).toEqual([
      "ability",
      "action",
      "bonus_action",
      "reaction",
      "legendary_action",
      "villain_action",
      "mythic_action",
    ]);
  });

  it("maps preset visibility and preserves source fields across every preset transition", () => {
    const source = { name: "Bolt", description: "Original prose", preset: "none" as const };
    const attack = switchActionPreset(source, "attack");
    const spellcasting = switchActionPreset(attack, "spellcasting");

    expect(presetFieldGroup("none")).toBeNull();
    expect(presetFieldGroup("attack")).toBe("attack");
    expect(presetFieldGroup("spellcasting")).toBe("spellcasting");
    expect(presetFieldGroup("innate_spellcasting")).toBe("innate_spellcasting");
    expect(presetFieldGroup("legendary_resistance")).toBeNull();
    expect(spellcasting).toMatchObject({ name: source.name, description: source.description, preset: "spellcasting" });
  });

  it("maps empty and zero numeric field drafts without collapsing zero", () => {
    expect(parseNonNegativeInteger("0")).toBe(0);
    expect(parseNonNegativeInteger("")).toBeNull();
    expect(parsePositiveInteger("0")).toBeNull();
    expect(parsePositiveInteger("2")).toBe(2);
    expect(parseIntegerAtLeast("-1", -1)).toBe(-1);
    expect(parseNonNegativeInteger("9007199254740992")).toBeNull();
    expect(parseNumberOrString("9007199254740993")).toBe("9007199254740993");
  });

  it("keeps durable object row keys unique after remove-then-add", () => {
    const keyState = createRepeatableKeyState(2);
    const firstKey = keyState.keys[0];
    const secondKey = keyState.keys[1];
    const rowState = new Map([[firstKey, "first"], [secondKey, "second"]]);

    keyState.keys = removeListItem(keyState.keys, 0);
    appendRepeatableKey(keyState);

    expect(keyState.keys).toEqual([secondKey, "row-2"]);
    expect(new Set(keyState.keys).size).toBe(2);
    expect(rowState.get(keyState.keys[0])).toBe("second");
  });

  it("keeps an action row key stable when an immutable field edit replaces its object", () => {
    const monster = createDefaultMonster();
    const items: ActionItem[] = [{ name: "Strike", description: "Original" }];
    const keyState = createRepeatableKeyState(items.length);
    const originalKey = keyState.keys[0];
    const updated = updateActionArray(monster, "action", items.map((item) => ({ ...item, description: "Edited" })));

    syncRepeatableKeys(keyState, updated.action?.length ?? 0);

    expect(updated.action?.[0]).not.toBe(items[0]);
    expect(updated.action?.[0].description).toBe("Edited");
    expect(keyState.keys[0]).toBe(originalKey);
  });

  it("selects the next, previous, or add focus target after deletion", () => {
    expect(repeatableFocusTarget(0, 2)).toEqual({ kind: "row", index: 0 });
    expect(repeatableFocusTarget(2, 2)).toEqual({ kind: "row", index: 1 });
    expect(repeatableFocusTarget(0, 0)).toEqual({ kind: "add" });
  });

  it("initializes incompatible spell schemas without reinterpreting nested groups", () => {
    const spellcasting = {
      name: "Caster",
      description: "Keep this",
      preset: "spellcasting" as const,
      spells: [["light"], [3, ["shield"]]],
    };
    const innate = switchActionPreset(spellcasting, "innate_spellcasting");
    expect(innate).toMatchObject({ name: "Caster", description: "Keep this", preset: "innate_spellcasting", spells: [] });

    const innateEdited = normalizeInnateSpellGroups([[-1, ["detect magic"]], [2, ["blur"]]]);
    const spellcastingAgain = switchActionPreset({ ...innate, spells: serializeInnateSpellGroups(innateEdited) }, "spellcasting");
    expect(spellcastingAgain.spells).toEqual([[], [0, []], [0, []], [0, []], [0, []], [0, []], [0, []], [0, []], [0, []], [0, []]]);

    const editedSpellcasting = normalizeSpellcastingSpells(spellcastingAgain.spells);
    editedSpellcasting.cantrips.push("mage hand");
    editedSpellcasting.levels[0].slots = 2;
    editedSpellcasting.levels[0].spells.push("shield");
    expect(serializeSpellcastingSpells(editedSpellcasting)).toEqual([
      ["mage hand"],
      [2, ["shield"]],
      [0, []], [0, []], [0, []], [0, []], [0, []], [0, []], [0, []], [0, []],
    ]);
  });

  it("maps token keyboard selection, Escape, and caret insertion deterministically", () => {
    expect(tokenPickerKeyAction("ArrowDown", 0, 4)).toEqual({ activeIndex: 1, action: "none", handled: true });
    expect(tokenPickerKeyAction("Home", 2, 4).activeIndex).toBe(0);
    expect(tokenPickerKeyAction("End", 0, 4).activeIndex).toBe(3);
    expect(tokenPickerKeyAction("Escape", 2, 4)).toEqual({ activeIndex: 2, action: "close", handled: true });
    expect(tokenPickerKeyAction("Enter", 2, 4).action).toBe("choose");
    expect(insertTokenAtSelection("Use ", 4, 4, "3D6 + 1")).toEqual({ value: "Use {{3D6 + 1}}", caret: 15 });
  });

  it("maps editable legendary, villain, and mythic introductions without losing other data", () => {
    const base = createDefaultMonster();
    const legendary = updateIntroDescription(base, "legendary_description", "Legendary intro");
    const villain = updateIntroDescription(legendary, "villain_description", "Villain intro");
    const mythic = updateIntroDescription(villain, "mythic_description", "Mythic intro");

    expect(mythic).toMatchObject({
      legendary_description: "Legendary intro",
      villain_description: "Villain intro",
      mythic_description: "Mythic intro",
      name: base.name,
    });
  });
});
