// @vitest-environment jsdom

import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import ProficienciesEditorTestWrapper from "./ProficienciesEditorTestWrapper.svelte";
import { createDefaultMonster } from "../../src/lib/monster/defaults";
import { monster } from "../../src/lib/state/monster-store";

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = "";
  monster.set(createDefaultMonster());
});

describe("ProficienciesEditor", () => {
  it("keeps an empty sense draft through unrelated edits and reports invalid input", () => {
    monster.set(createDefaultMonster());
    mounted = mount(ProficienciesEditorTestWrapper, { target: document.body });
    flushSync();

    const input = document.getElementById("sense-darkvision") as HTMLInputElement;
    input.focus();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();

    expect(input.value).toBe("");
    expect(input.getAttribute("aria-invalid")).toBe("true");

    monster.update((current) => ({ ...current, name: "Unrelated edit" }));
    flushSync();
    expect(input.value).toBe("");

    input.value = "not a distance";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
    flushSync();

    expect(input.value).toBe("not a distance");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.querySelector("#sense-darkvision-error")?.textContent).toContain("zero or a positive whole number");
  });

  it("keeps valid zero and positive sense values in the normalized store", () => {
    monster.set(createDefaultMonster());
    mounted = mount(ProficienciesEditorTestWrapper, { target: document.body });
    flushSync();

    const input = document.getElementById("sense-blindsight") as HTMLInputElement;
    input.value = "0";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();
    input.value = "60";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();

    let current: ReturnType<typeof createDefaultMonster> | undefined;
    const unsubscribe = monster.subscribe((value) => (current = value));
    unsubscribe();
    expect(current?.proficiencies?.senses?.[0]).toBe(60);
  });

  it("uses canonical selectors and removes a matching resistance when adding immunity", () => {
    monster.set({
      ...createDefaultMonster(),
      proficiencies: {
        ...createDefaultMonster().proficiencies,
        damage_resistances: ["fire", "cold"],
      },
    });
    mounted = mount(ProficienciesEditorTestWrapper, { target: document.body });
    flushSync();

    const resistanceSelect = document.getElementById("canonical-damage-damage-resistances") as HTMLSelectElement;
    resistanceSelect.value = "acid";
    resistanceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    flushSync();

    const immunitySelect = document.getElementById("canonical-damage-damage-immunities") as HTMLSelectElement;
    immunitySelect.value = "__other__";
    immunitySelect.dispatchEvent(new Event("change", { bubbles: true }));
    flushSync();
    const customInput = document.querySelector<HTMLInputElement>('input[aria-label="Custom damage immunities"]')!;
    customInput.value = " FIRE ";
    customInput.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector<HTMLButtonElement>("#canonical-damage-damage-immunities + .canonical-selector__custom button")!.click();
    flushSync();

    let current: ReturnType<typeof createDefaultMonster> | undefined;
    const unsubscribe = monster.subscribe((value) => (current = value));
    unsubscribe();
    expect(current?.proficiencies?.damage_resistances).toEqual(["acid", "cold"]);
    expect(current?.proficiencies?.damage_immunities).toEqual(["fire"]);
    expect(document.querySelector('[aria-label="Remove fire"]')).not.toBeNull();
    expect(document.querySelectorAll(".repeatable")).toHaveLength(0);
  });

  it("exposes a damage vulnerabilities selector and stores canonical selections", () => {
    monster.set(createDefaultMonster());
    mounted = mount(ProficienciesEditorTestWrapper, { target: document.body });
    flushSync();

    const vulnerabilitySelect = document.getElementById("canonical-damage-damage-vulnerabilities") as HTMLSelectElement;
    expect(vulnerabilitySelect.getAttribute("aria-label")).toBe("Add damage vulnerabilities");
    expect(document.querySelector('label[for="canonical-damage-damage-vulnerabilities"]')?.textContent).toBe("Damage vulnerabilities");
    const vulnerabilityHelp = document.querySelector<HTMLButtonElement>('[aria-label="Damage vulnerabilities information"]');
    expect(vulnerabilityHelp).not.toBeNull();
    const vulnerabilityHelpId = vulnerabilityHelp?.getAttribute("aria-describedby");
    expect(vulnerabilityHelpId).not.toBeNull();
    expect(document.getElementById(vulnerabilityHelpId ?? "")?.textContent).toContain("Damage types or sources that deal extra damage");

    vulnerabilitySelect.value = "fire";
    vulnerabilitySelect.dispatchEvent(new Event("change", { bubbles: true }));
    flushSync();

    let current: ReturnType<typeof createDefaultMonster> | undefined;
    const unsubscribe = monster.subscribe((value) => (current = value));
    unsubscribe();
    expect(current?.proficiencies?.damage_vulnerabilities).toEqual(["fire"]);
  });

  it("filters resistance and vulnerability updates that match current immunities", () => {
    const base = createDefaultMonster();
    monster.set({
      ...base,
      proficiencies: {
        ...base.proficiencies,
        damage_immunities: ["fire"],
      },
    });
    mounted = mount(ProficienciesEditorTestWrapper, { target: document.body });
    flushSync();

    const resistanceSelect = document.getElementById("canonical-damage-damage-resistances") as HTMLSelectElement;
    resistanceSelect.value = "fire";
    resistanceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    const vulnerabilitySelect = document.getElementById("canonical-damage-damage-vulnerabilities") as HTMLSelectElement;
    vulnerabilitySelect.value = "fire";
    vulnerabilitySelect.dispatchEvent(new Event("change", { bubbles: true }));
    flushSync();

    let current: ReturnType<typeof createDefaultMonster> | undefined;
    const unsubscribe = monster.subscribe((value) => (current = value));
    unsubscribe();
    expect(current?.proficiencies?.damage_immunities).toEqual(["fire"]);
    expect(current?.proficiencies?.damage_resistances).toEqual([]);
    expect(current?.proficiencies?.damage_vulnerabilities).toEqual([]);
  });
});
