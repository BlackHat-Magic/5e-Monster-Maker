// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { normalizeMonster } from "../../src/lib/monster/defaults";
import { createPreviewModel, previewSectionUnitCount, splitPreviewSections, splitPreviewSectionsAtBoundary, splitPreviewSectionsByWeights } from "../../src/lib/monster/preview";
import type { Monster } from "../../src/lib/monster/types";
import type { MonsterPreview } from "../../src/lib/monster/preview";

const dragon: Monster = normalizeMonster({
  name: "Ancient Red Dragon",
  shortened_name: "dragon",
  basics: {
    size: "gargantuan",
    type: "dragon",
    tag: "fire",
    alignment: "chaotic evil",
    flavor: "A terrible flame-breathing dragon.",
  },
  stats: {
    base_ac: 22,
    armor: "natural armor",
    hit_dice: 28,
    speed: [40, 0, 40, 80, 0],
    ability_scores: [30, 10, 29, 18, 15, 23],
  },
  proficiencies: {
    saves: ["str", "wis"],
    skills: ["perception", "stealth"],
    expertise: ["perception"],
    damage_vulnerabilities: ["radiant", "fire"],
    damage_resistances: ["fire", "cold, poison"],
    damage_immunities: ["fire"],
    condition_immunities: ["frightened"],
    senses: [60, 120, 0, 0, 30],
    challenge: 24,
  },
  language: [
    { name: "Common", status: "speaks" },
    { name: "Draconic", status: "understands", but: "only a little" },
  ],
  is_legendary: true,
  legendary_description: "{{MON}} has a custom legendary intro.",
  is_villain: true,
  villain_description: "{{MON}} has a custom villain intro.",
  is_mythic: true,
  mythic_description: "{{MON}} has a custom mythic intro.",
  ability: [{ name: "Trait", description: "{{MON}} has a trait." }],
  action: [
    {
      name: "Dangerous Action",
      description: '{{MON}} acts. <img src="x" onerror="alert(1)">',
    },
  ],
  bonus_action: [{ name: "Bonus", description: "{{MON}} uses a bonus action." }],
  reaction: [{ name: "Reaction", description: "{{MON}} reacts." }],
  legendary_action: [{ name: "Legendary", description: "{{MON}} takes a legendary action." }],
  villain_action: [{ name: "Villain", description: "{{MON}} takes a villain action." }],
  mythic_action: [{ name: "Mythic", description: "{{MON}} takes a mythic action." }],
});

function previewForSections(sections: MonsterPreview["sections"]): MonsterPreview {
  const text = { markdown: "", html: "" };
  const field = { label: "", value: "", ...text };
  return {
    name: text,
    meta: null,
    flavor: null,
    armorClass: { label: "Armor Class", value: "", ...text },
    hitPoints: { label: "Hit Points", value: "", ...text },
    speed: { label: "Speed", value: "", ...text },
    abilities: [],
    fields: [field],
    challenge: { challenge: "0", xp: 0, xpText: "0", proficiencyBonus: 2, proficiencyBonusText: "+2", ...text },
    sections,
  };
}

describe("monster preview model", () => {
  it("requires a browser DOM at the preview entry point and restores globals", () => {
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");

    try {
      Object.defineProperty(globalThis, "window", { configurable: true, value: undefined, writable: true });
      Object.defineProperty(globalThis, "document", { configurable: true, value: undefined, writable: true });
      expect(() => createPreviewModel(dragon)).toThrow("createPreviewModel requires a browser DOM");
    } finally {
      if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
      else Reflect.deleteProperty(globalThis, "window");
      if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
      else Reflect.deleteProperty(globalThis, "document");
    }
  });

  it("generates identity, calculated fields, ability rows, labeled fields, and challenge data", () => {
    const preview = createPreviewModel(dragon);

    expect(preview.name.markdown).toBe("Ancient Red Dragon");
    expect(preview.name.html).toContain("Ancient Red Dragon");
    expect(preview.meta?.markdown).toBe("*gargantuan dragon (fire), chaotic evil*");
    expect(preview.meta?.html).toContain("<em>gargantuan dragon (fire), chaotic evil</em>");
    expect(preview.flavor?.html).toContain("A terrible flame-breathing dragon.");

    expect(preview.armorClass.value).toBe("22 (natural armor)");
    expect(preview.armorClass.html).toContain("<strong>Armor Class</strong> 22 (natural armor)");
    expect(preview.hitPoints.value).toBe("546 (28d20 + 252)");
    expect(preview.hitPoints.html).toContain("<strong>Hit Points</strong> 546 (28d20 + 252)");
    expect(preview.speed.value).toBe("40 ft., climb 40 ft., fly 80 ft.");
    expect(preview.speed.html).toContain("<strong>Speed</strong> 40 ft., climb 40 ft., fly 80 ft.");

    expect(preview.abilities).toHaveLength(6);
    expect(preview.abilities).toEqual([
      { key: "str", label: "STR", score: 30, modifier: 10, modifierText: "+10" },
      { key: "dex", label: "DEX", score: 10, modifier: 0, modifierText: "+0" },
      { key: "con", label: "CON", score: 29, modifier: 9, modifierText: "+9" },
      { key: "int", label: "INT", score: 18, modifier: 4, modifierText: "+4" },
      { key: "wis", label: "WIS", score: 15, modifier: 2, modifierText: "+2" },
      { key: "cha", label: "CHA", score: 23, modifier: 6, modifierText: "+6" },
    ]);

    const fieldValues = Object.fromEntries(preview.fields.map((item) => [item.label, item.value]));
    expect(fieldValues).toMatchObject({
      "Saving Throws": "STR +17, WIS +9",
      Skills: "Perception +16 (expertise), Stealth +7",
      "Damage Vulnerabilities": "radiant",
       "Damage Resistances": "cold, poison",
      "Damage Immunities": "fire",
      "Condition Immunities": "frightened",
      Senses: "blindsight 60 ft., darkvision 120 ft., passive Perception 26",
      Languages: "Common, understands Draconic but only a little, telepathy 30 ft.",
    });
    const defenseFieldLabels = preview.fields
      .map((field) => field.label)
      .filter((label) => [
        "Damage Vulnerabilities",
        "Damage Resistances",
        "Damage Immunities",
        "Condition Immunities",
      ].includes(label));
    expect(defenseFieldLabels).toEqual([
      "Damage Vulnerabilities",
      "Damage Resistances",
      "Damage Immunities",
      "Condition Immunities",
    ]);
    expect(preview.fields.every((item) => item.html.includes("<strong>"))).toBe(true);

    expect(preview.challenge).toMatchObject({
      challenge: "24",
      xp: 62000,
      xpText: "62,000",
      proficiencyBonus: 7,
      proficiencyBonusText: "+7",
    });
    expect(preview.challenge.html).toContain("62,000 XP");
    expect(preview.challenge.html).toContain("<strong>Proficiency Bonus</strong> +7");
  });

  it("keeps raw damage immunities out of vulnerabilities and resistances", () => {
    const preview = createPreviewModel({
      proficiencies: {
        damage_vulnerabilities: ["fire", "radiant"],
        damage_resistances: ["Fire", "cold"],
        damage_immunities: [" FIRE "],
      },
    });
    const fieldValues = Object.fromEntries(preview.fields.map((item) => [item.label, item.value]));

    expect(fieldValues["Damage Vulnerabilities"]).toBe("radiant");
    expect(fieldValues["Damage Resistances"]).toBe("cold");
    expect(fieldValues["Damage Immunities"]).toBe("fire");
  });

  it("generates all enabled sections, resolves tokens, sanitizes HTML, and gates mythic actions", () => {
    const preview = createPreviewModel(dragon);
    const sections = Object.fromEntries(preview.sections.map((section) => [section.key, section]));

    expect(Object.keys(sections)).toEqual([
      "ability",
      "action",
      "bonus_action",
      "reaction",
      "legendary_action",
      "villain_action",
      "mythic_action",
    ]);
    expect(sections.ability.items[0].html).toContain("The dragon has a trait");
    expect(sections.action.items[0].html).toContain("The dragon acts");
    expect(sections.action.items[0].html).not.toContain("onerror");
    expect(sections.action.items[0].html).not.toContain("{{MON}}");
    expect(sections.bonus_action.items[0].html).toContain("The dragon uses a bonus action");
    expect(sections.reaction.items[0].html).toContain("The dragon reacts");
    expect(sections.legendary_action.items[0].html).toContain("The dragon takes a legendary action");
    expect(sections.villain_action.items[0].html).toContain("The dragon takes a villain action");
    expect(sections.mythic_action.items[0].html).toContain("The dragon takes a mythic action");

    expect(sections.legendary_action.intro?.html).toContain("The dragon has a custom legendary intro");
    expect(sections.villain_action.intro?.html).toContain("The dragon has a custom villain intro");
    expect(sections.mythic_action.intro?.html).toContain("The dragon has a custom mythic intro");

    const gated = createPreviewModel(
      normalizeMonster({
        is_mythic: true,
        mythic_action: [{ name: "Mythic", description: "Should be gated." }],
      }),
    );
    expect(gated.sections.some((section) => section.key === "mythic_action")).toBe(false);
  });

  it("chooses a deterministic boundary between complete preview sections", () => {
    const preview = createPreviewModel(dragon);
    const first = splitPreviewSections(preview);
    const second = splitPreviewSections(preview);

    expect(first).toEqual(second);
    expect(first.left.length).toBeGreaterThan(0);
    expect(first.right.length).toBeGreaterThan(0);
    expect([...first.left, ...first.right].map((section) => section.key)).toEqual(
      preview.sections.map((section) => section.key),
    );
  });

  it("allows measured section heights to choose a different boundary than the estimate", () => {
    const sections: MonsterPreview["sections"] = [
      { key: "ability", title: "", intro: null, items: [] },
      { key: "action", title: "Actions", intro: null, items: [] },
      { key: "reaction", title: "Reactions", intro: null, items: [] },
      { key: "bonus_action", title: "Bonus Actions", intro: null, items: [] },
    ];
    const preview = previewForSections(sections);
    const estimated = splitPreviewSections(preview);
    const measured = splitPreviewSectionsByWeights(preview, 1, [1, 1, 1, 100]);

    expect(estimated.left.length).not.toBe(measured.left.length);
    expect(measured.left.map((section) => section.key)).toEqual(["ability", "action", "reaction"]);
    expect(measured.right.map((section) => section.key)).toEqual(["bonus_action"]);
    expect([...measured.left, ...measured.right]).toEqual(sections);
  });

  it("splits populated sections only between items and keeps the header on the first fragment", () => {
    const item = (name: string) => ({
      name,
      description: `${name} description.`,
      markdown: `***${name}.*** ${name} description.`,
      html: `<p><strong><em>${name}.</em></strong> ${name} description.</p>`,
    });
    const section: MonsterPreview["sections"][number] = {
      key: "action",
      title: "Actions",
      intro: { markdown: "Choose an action.", html: "<p>Choose an action.</p>" },
      items: [item("First"), item("Second"), item("Third")],
    };
    const result = splitPreviewSectionsByWeights(previewForSections([section]), 1, [6], [[2, 2, 2]]);

    expect(result.left).toHaveLength(1);
    expect(result.left[0]).toMatchObject({ title: "Actions", intro: section.intro, items: [section.items[0]] });
    expect(result.right).toHaveLength(1);
    expect(result.right[0]).toMatchObject({ title: "", intro: null, items: section.items.slice(1) });
  });

  it("keeps an empty section with its header and intro as one unit", () => {
    const emptySection: MonsterPreview["sections"][number] = {
      key: "reaction",
      title: "Reactions",
      intro: { markdown: "An empty reaction section.", html: "<p>An empty reaction section.</p>" },
      items: [],
    };
    const populatedSection: MonsterPreview["sections"][number] = {
      key: "action",
      title: "Actions",
      intro: null,
      items: [{ name: "Action", description: "Description.", markdown: "Action", html: "<p>Action</p>" }],
    };
    const result = splitPreviewSectionsByWeights(
      previewForSections([populatedSection, emptySection]),
      0,
      [1, 1],
      [[1], undefined],
    );

    expect(result.right).toEqual([emptySection]);
  });

  it("keeps an empty section list empty", () => {
    expect(splitPreviewSections(previewForSections([]))).toEqual({ left: [], right: [] });
  });

  it("enumerates item boundaries while keeping empty sections indivisible", () => {
    const previewItem = (name: string) => ({ name, description: `${name} description.`, markdown: name, html: `<p>${name}</p>` });
    const sections: MonsterPreview["sections"] = [
      { key: "ability", title: "", intro: null, items: [previewItem("Trait one"), previewItem("Trait two")] },
      { key: "action", title: "Actions", intro: null, items: [] },
      { key: "reaction", title: "Reactions", intro: null, items: [previewItem("Reaction")] },
    ];
    const preview = previewForSections(sections);

    expect(previewSectionUnitCount(preview)).toBe(4);
    expect(splitPreviewSectionsAtBoundary(preview, 1).left[0]?.items).toHaveLength(1);
    expect(splitPreviewSectionsAtBoundary(preview, 2).left[0]?.items).toHaveLength(2);
    expect(splitPreviewSectionsAtBoundary(preview, 2).right[0]).toEqual(sections[1]);
    expect(splitPreviewSectionsAtBoundary(preview, 3).right[0]?.key).toBe("reaction");
    expect(() => splitPreviewSectionsAtBoundary(preview, 0)).toThrow();
    expect(() => splitPreviewSectionsAtBoundary(preview, 4)).toThrow();
  });

  it("keeps one section intact on the left", () => {
    const sections: MonsterPreview["sections"] = [{ key: "ability", title: "", intro: null, items: [] }];
    const result = splitPreviewSections(previewForSections(sections));

    expect(result.left).toEqual(sections);
    expect(result.right).toEqual([]);
  });

  it("preserves multiple sparse sections without splitting or losing them", () => {
    const sections: MonsterPreview["sections"] = [
      { key: "ability", title: "", intro: null, items: [] },
      { key: "action", title: "Actions", intro: null, items: [] },
      { key: "reaction", title: "Reactions", intro: { markdown: "", html: "" }, items: [] },
    ];
    const result = splitPreviewSections(previewForSections(sections));

    expect(result.left.length).toBeGreaterThan(0);
    expect(result.right.length).toBeGreaterThan(0);
    expect([...result.left, ...result.right]).toEqual(sections);
    expect(new Set([...result.left, ...result.right].map((section) => section.key)).size).toBe(sections.length);
  });

  it("keeps one whole lower section on each side when the prelude dominates", () => {
    const longPrelude = "A dominant prelude value ".repeat(250);
    const section = (key: "ability" | "action" | "bonus_action", title: string) => ({
      key,
      title,
      intro: null,
      items: [{
        name: title || "Trait",
        description: "A short lower section.",
        markdown: "***Trait.*** A short lower section.",
        html: "<p><strong><em>Trait.</em></strong> A short lower section.</p>",
      }],
    });
    const dominantPrelude: MonsterPreview = {
      name: { markdown: longPrelude, html: longPrelude },
      meta: null,
      flavor: null,
      armorClass: { label: "Armor Class", value: longPrelude, markdown: longPrelude, html: longPrelude },
      hitPoints: { label: "Hit Points", value: longPrelude, markdown: longPrelude, html: longPrelude },
      speed: { label: "Speed", value: longPrelude, markdown: longPrelude, html: longPrelude },
      abilities: [],
      fields: [{ label: "Notes", value: longPrelude, markdown: longPrelude, html: longPrelude }],
      challenge: {
        challenge: "0",
        xp: 10,
        xpText: "10",
        proficiencyBonus: 2,
        proficiencyBonusText: "+2",
        markdown: longPrelude,
        html: longPrelude,
      },
      sections: [section("ability", ""), section("action", "Actions"), section("bonus_action", "Bonus Actions")],
    };

    const result = splitPreviewSections(dominantPrelude);

    expect(result.left.map((item) => item.key)).toEqual(["ability"]);
    expect(result.right.map((item) => item.key)).toEqual(["action", "bonus_action"]);
    expect([...result.left, ...result.right]).toEqual(dominantPrelude.sections);
  });

  it("gates legendary and villain sections independently and keeps mythic transformation gating", () => {
    const sectionsFor = (flags: Pick<Monster, "is_legendary" | "is_villain" | "is_mythic">) => Object.fromEntries(
      createPreviewModel(normalizeMonster({
        ...flags,
        legendary_action: [{ name: "Legendary", description: "Legendary entry." }],
        villain_action: [{ name: "Villain", description: "Villain entry." }],
        mythic_action: [{ name: "Mythic", description: "Mythic entry." }],
      })).sections.map((section) => [section.key, section]),
    );

    expect(sectionsFor({ is_legendary: true, is_villain: false, is_mythic: false })).toHaveProperty("legendary_action");
    expect(sectionsFor({ is_legendary: true, is_villain: false, is_mythic: false })).not.toHaveProperty("villain_action");
    expect(sectionsFor({ is_legendary: false, is_villain: true, is_mythic: false })).not.toHaveProperty("legendary_action");
    expect(sectionsFor({ is_legendary: false, is_villain: true, is_mythic: false })).toHaveProperty("villain_action");
    expect(sectionsFor({ is_legendary: false, is_villain: false, is_mythic: true })).not.toHaveProperty("mythic_action");
    expect(sectionsFor({ is_legendary: true, is_villain: false, is_mythic: true })).toHaveProperty("mythic_action");
    expect(sectionsFor({ is_legendary: false, is_villain: true, is_mythic: true })).toHaveProperty("mythic_action");
  });
});
