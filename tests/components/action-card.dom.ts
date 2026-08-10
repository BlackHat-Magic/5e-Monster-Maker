// @vitest-environment jsdom

import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import ActionCardTestWrapper from "./ActionCardTestWrapper.svelte";
import type { ActionItem } from "../../src/lib/monster/types";
import { hasPendingEditorDraft } from "../../src/lib/state/editor-draft-store";

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = "";
});

describe("ActionCard", () => {
	it("resolves a Field control's help description reference to portaled help content", () => {
		const initialItem: ActionItem = { name: "Help target", preset: "none" };
		mounted = mount(ActionCardTestWrapper, { target: document.body, props: { initialItem } });
		flushSync();

		const control = document.getElementById("action-action-0-name-field") as HTMLInputElement;
		const helpId = control.getAttribute("aria-describedby")?.split(" ")[0];
		const help = helpId ? document.getElementById(helpId) : null;

		expect(helpId).toBe("action-action-0-name-field-help");
		expect(help).not.toBeNull();
		expect(help?.textContent).toContain("The action name shown in the stat block.");
	});

  it("renders and updates advanced save and area fields for a custom action", () => {
    const initialItem: ActionItem = {
      name: "Imported save",
      preset: "none",
      dc_ability: "wis",
      save: "dex",
      dice: "0",
      damage_type_save: "cold",
      area: "15-foot cone",
      targets: "creatures of choice",
    };
    mounted = mount(ActionCardTestWrapper, { target: document.body, props: { initialItem } });
    flushSync();

    expect((document.getElementById("action-action-0-dc-ability") as HTMLSelectElement).value).toBe("wis");
    expect((document.getElementById("action-action-0-save") as HTMLSelectElement).value).toBe("dex");
    expect((document.getElementById("action-action-0-dice") as HTMLInputElement).value).toBe("0");
    expect((document.getElementById("action-action-0-area") as HTMLInputElement).value).toBe("15-foot cone");

    const save = document.getElementById("action-action-0-save") as HTMLSelectElement;
    save.value = "cha";
    save.dispatchEvent(new Event("change", { bubbles: true }));
    flushSync();
    const targets = document.getElementById("action-action-0-targets") as HTMLInputElement;
    targets.value = "all hostile creatures";
    targets.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();

    expect(JSON.parse(document.querySelector("[data-testid=action-json]")?.textContent ?? "{}")).toMatchObject({ save: "cha", targets: "all hostile creatures", dice: "0" });
  });

  it("keeps a prepared spell repeatable list interactive inside spellcasting actions", async () => {
    const initialItem: ActionItem = {
      name: "Prepared caster",
      preset: "spellcasting",
      spells: [[], [0, ["Light"]]],
    };
    mounted = mount(ActionCardTestWrapper, { target: document.body, props: { initialItem } });
    flushSync();

    const findPreparedList = (): HTMLElement | null => document.querySelector<HTMLElement>(".spell-level .repeatable");
    const preparedList = findPreparedList();
    expect(preparedList).not.toBeNull();
    expect(preparedList?.getAttribute("aria-label")).toBe("Level 1 prepared spells");
    expect(preparedList?.querySelector<HTMLElement>(".repeatable__count")?.textContent).toBe("1");

    const spell = findPreparedList()?.querySelector<HTMLInputElement>("input");
    expect(spell).not.toBeNull();
    if (!spell) return;
    spell.value = "Shield";
    spell.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();
    findPreparedList()?.querySelector<HTMLButtonElement>('[aria-label="Remove Shield"]')?.click();
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(findPreparedList()?.querySelector<HTMLElement>(".repeatable__count")?.textContent).toBe("0");
    expect(findPreparedList()?.querySelector('[role="status"]')?.textContent).toContain("No level 1 prepared spells yet");
  });

  it("keeps a dirty innate frequency draft with its group through deletion and reorder", async () => {
    const initialItem: ActionItem = {
      name: "Innate caster",
      preset: "innate_spellcasting",
      spells: [[1, []], [2, []], [3, []]],
    };
    mounted = mount(ActionCardTestWrapper, { target: document.body, props: { initialItem } });
    flushSync();

    const dirtyInput = document.getElementById("action-action-0-innate-frequency-1") as HTMLInputElement;
    dirtyInput.value = "draft-b";
    dirtyInput.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();
    expect(dirtyInput.value).toBe("draft-b");
    expect(dirtyInput.getAttribute("aria-invalid")).toBe("true");

    document.querySelector<HTMLButtonElement>('[aria-label="Remove 1/day each"]')?.click();
    flushSync();
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((document.getElementById("action-action-0-innate-frequency-0") as HTMLInputElement).value).toBe("draft-b");
    expect((document.getElementById("action-action-0-innate-frequency-1") as HTMLInputElement).value).toBe("3");
    expect((document.getElementById("action-action-0-innate-frequency-0") as HTMLInputElement).getAttribute("aria-invalid")).toBe("true");
    expect((document.getElementById("action-action-0-innate-frequency-1") as HTMLInputElement).getAttribute("aria-invalid")).toBe("false");
    expect(document.activeElement?.getAttribute("data-repeatable-row")).toBe("0");

    const dragHandle = document.querySelector<HTMLButtonElement>('[aria-label="Drag 3/day each"]')!;
    dragHandle.focus();
    dragHandle.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    flushSync();
    dragHandle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
    (document.activeElement as HTMLButtonElement).dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    flushSync();
    flushSync();

    expect((document.getElementById("action-action-0-innate-frequency-0") as HTMLInputElement).value).toBe("3");
    expect((document.getElementById("action-action-0-innate-frequency-1") as HTMLInputElement).value).toBe("draft-b");
    expect((document.getElementById("action-action-0-innate-frequency-0") as HTMLInputElement).getAttribute("aria-invalid")).toBe("false");
    expect((document.getElementById("action-action-0-innate-frequency-1") as HTMLInputElement).getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(document.querySelector('[aria-label="Drag 3/day each"]'));
  });

  it("clears invalid preset drafts when switching away and back while preserving common fields", () => {
    const initialItem: ActionItem = {
      name: "Configured attack",
      preset: "attack",
      reach: 10,
      save: "dex",
    };
    mounted = mount(ActionCardTestWrapper, { target: document.body, props: { initialItem } });
    flushSync();

    const reach = document.getElementById("action-action-0-attack-reach") as HTMLInputElement;
    reach.focus();
    reach.value = "12x";
    reach.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();
    expect(reach.value).toBe("12x");
    expect(reach.getAttribute("aria-invalid")).toBe("true");

    const preset = document.getElementById("action-action-0-preset") as HTMLSelectElement;
    preset.value = "none";
    preset.dispatchEvent(new Event("change", { bubbles: true }));
    flushSync();

    expect(document.getElementById("action-action-0-attack-reach")).toBeNull();
    expect((document.getElementById("action-action-0-save") as HTMLSelectElement).value).toBe("dex");
    expect(hasPendingEditorDraft()).toBe(false);

    preset.value = "attack";
    preset.dispatchEvent(new Event("change", { bubbles: true }));
    flushSync();

    const restoredReach = document.getElementById("action-action-0-attack-reach") as HTMLInputElement;
    expect(restoredReach.value).toBe("10");
    expect(restoredReach.getAttribute("aria-invalid")).toBe("false");
    expect((document.getElementById("action-action-0-save") as HTMLSelectElement).value).toBe("dex");
  });

  it("preserves an invalid numeric draft and error when its repeatable item is collapsed", () => {
    const initialItem: ActionItem = {
      name: "Collapsed attack",
      preset: "attack",
      reach: 10,
    };
    mounted = mount(ActionCardTestWrapper, { target: document.body, props: { initialItem } });
    flushSync();

    const reach = document.getElementById("action-action-0-attack-reach") as HTMLInputElement;
    reach.value = "12x";
    reach.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();

    expect(reach.value).toBe("12x");
    expect(reach.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById("action-action-0-attack-reach-error")?.textContent).toContain("non-negative safe whole number");

    const collapse = document.querySelector<HTMLButtonElement>('[data-repeatable-collapse]')!;
    collapse.click();
    flushSync();
    expect(collapse.getAttribute("aria-expanded")).toBe("false");

    collapse.click();
    flushSync();

    const restoredReach = document.getElementById("action-action-0-attack-reach") as HTMLInputElement;
    expect(restoredReach.value).toBe("12x");
    expect(restoredReach.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById("action-action-0-attack-reach-error")?.textContent).toContain("non-negative safe whole number");
  });
});
