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
});
