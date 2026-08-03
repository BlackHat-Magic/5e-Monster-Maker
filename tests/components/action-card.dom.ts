// @vitest-environment jsdom

import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import ActionCardTestWrapper from "./ActionCardTestWrapper.svelte";
import type { ActionItem } from "../../src/lib/monster/types";

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = "";
});

describe("ActionCard", () => {
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

    expect((document.getElementById("action-dc-ability-0") as HTMLSelectElement).value).toBe("wis");
    expect((document.getElementById("action-save-0") as HTMLSelectElement).value).toBe("dex");
    expect((document.getElementById("action-dice-0") as HTMLInputElement).value).toBe("0");
    expect((document.getElementById("action-area-0") as HTMLInputElement).value).toBe("15-foot cone");

    const save = document.getElementById("action-save-0") as HTMLSelectElement;
    save.value = "cha";
    save.dispatchEvent(new Event("change", { bubbles: true }));
    flushSync();
    const targets = document.getElementById("action-targets-0") as HTMLInputElement;
    targets.value = "all hostile creatures";
    targets.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();

    expect(JSON.parse(document.querySelector("[data-testid=action-json]")?.textContent ?? "{}")).toMatchObject({ save: "cha", targets: "all hostile creatures", dice: "0" });
  });

  it("keeps a dirty innate frequency draft with its group through deletion and reorder", async () => {
    const initialItem: ActionItem = {
      name: "Innate caster",
      preset: "innate_spellcasting",
      spells: [[1, []], [2, []], [3, []]],
    };
    mounted = mount(ActionCardTestWrapper, { target: document.body, props: { initialItem } });
    flushSync();

    const dirtyInput = document.getElementById("innate-frequency-0-1") as HTMLInputElement;
    dirtyInput.value = "draft-b";
    dirtyInput.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();
    expect(dirtyInput.value).toBe("draft-b");
    expect(dirtyInput.getAttribute("aria-invalid")).toBe("true");

    document.querySelector<HTMLButtonElement>('[aria-label="Remove 1/day each"]')?.click();
    flushSync();
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((document.getElementById("innate-frequency-0-0") as HTMLInputElement).value).toBe("draft-b");
    expect((document.getElementById("innate-frequency-0-1") as HTMLInputElement).value).toBe("3");
    expect((document.getElementById("innate-frequency-0-0") as HTMLInputElement).getAttribute("aria-invalid")).toBe("true");
    expect((document.getElementById("innate-frequency-0-1") as HTMLInputElement).getAttribute("aria-invalid")).toBe("false");
    expect(document.activeElement?.getAttribute("data-repeatable-row")).toBe("0");

    document.querySelector<HTMLButtonElement>('[aria-label="Move 3/day each up"]')?.click();
    flushSync();

    expect((document.getElementById("innate-frequency-0-0") as HTMLInputElement).value).toBe("3");
    expect((document.getElementById("innate-frequency-0-1") as HTMLInputElement).value).toBe("draft-b");
    expect((document.getElementById("innate-frequency-0-0") as HTMLInputElement).getAttribute("aria-invalid")).toBe("false");
    expect((document.getElementById("innate-frequency-0-1") as HTMLInputElement).getAttribute("aria-invalid")).toBe("true");
  });

  it("clears stale numeric drafts when the same row receives a replacement action", () => {
    const initialItem: ActionItem = {
      name: "Original attack",
      preset: "attack",
      reach: 10,
    };
    const replacementItem: ActionItem = {
      name: "Imported action without reach",
      preset: "attack",
    };
    mounted = mount(ActionCardTestWrapper, { target: document.body, props: { initialItem, replacementItem } });
    flushSync();

    const reach = document.getElementById("attack-reach-0") as HTMLInputElement;
    reach.focus();
    reach.value = "12x";
    reach.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();

    expect(reach.value).toBe("12x");
    expect(reach.getAttribute("aria-invalid")).toBe("true");

    const name = document.getElementById("action-name-field-0") as HTMLInputElement;
    name.value = "Edited original attack";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();
    expect(reach.value).toBe("12x");
    expect(reach.getAttribute("aria-invalid")).toBe("true");

    document.querySelector<HTMLButtonElement>('[data-testid="replace-action"]')?.click();
    flushSync();

    expect(reach.value).toBe("");
    expect(reach.getAttribute("aria-invalid")).toBe("false");
    expect((document.getElementById("action-name-field-0") as HTMLInputElement).value).toBe("Imported action without reach");
  });
});
