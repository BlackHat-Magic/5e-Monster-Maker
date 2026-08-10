// Native mounting is verified for the empty section shell. The current
// Vitest 4 + Svelte 5 jsdom transform rejects this app's parameterized
// snippets when a repeatable item renders, and @hugeicons/svelte currently
// throws while mounting its icon in jsdom. The blocked item interactions are
// covered by exported pure helpers in action-editor.test.ts rather than
// skipped; focus behavior remains the documented limitation of this setup.

import { flushSync, mount, unmount } from "svelte";
import { describe, expect, it } from "vitest";
import { ACTION_ARRAY_KEYS } from "../../src/lib/components/editor/action-editor-core";
import ActionSectionEditor from "../../src/lib/components/editor/ActionSectionEditor.svelte";
import { createDefaultMonster } from "../../src/lib/monster/defaults";
import { monster, replaceMonster } from "../../src/lib/state/monster-store";

describe("action editor native DOM shell", () => {
  it("mounts and unmounts every action section target with its empty state", () => {
    const labels = new Map([
      ["ability", "Traits"],
      ["action", "Actions"],
      ["bonus_action", "Bonus Actions"],
      ["reaction", "Reactions"],
      ["legendary_action", "Legendary"],
      ["villain_action", "Villain"],
      ["mythic_action", "Mythic"],
    ]);

    for (const target of ACTION_ARRAY_KEYS) {
      const host = document.createElement("div");
      document.body.append(host);
      const component = mount(ActionSectionEditor, {
        target: host,
        props: {
          target,
          sectionTitle: labels.get(target) ?? target,
          ...(target === "legendary_action" ? { specialFlagKey: "is_legendary", introDescriptionKey: "legendary_description" } : {}),
          ...(target === "villain_action" ? { specialFlagKey: "is_villain", introDescriptionKey: "villain_description" } : {}),
          ...(target === "mythic_action" ? { specialFlagKey: "is_mythic", introDescriptionKey: "mythic_description" } : {}),
        },
      });
      flushSync();

      const section = host.querySelector(".repeatable");
      expect(section).not.toBeNull();
      expect(section?.getAttribute("aria-label")).toBe(labels.get(target));
      expect(section?.querySelector("h2")?.textContent).toContain(labels.get(target));
      expect(section?.querySelector(".repeatable__count")?.textContent).toBe("0");
      expect(section?.querySelector("[data-repeatable-add]")?.getAttribute("aria-label")).toMatch(/^Add /);
      expect(host.querySelector(".repeatable__empty")).not.toBeNull();
      expect(host.querySelector(".repeatable__index")).toBeNull();
      expect(host.textContent).not.toMatch(/Repeatable Field|Authoring Index|Monster Particulars|Autosaved Locally/);
      unmount(component);
      expect(host.innerHTML).toBe("");
      host.remove();
    }
  });

  it("mounts each special section with its flag, description, and action controls", () => {
    const special = [
      ["legendary_action", "is_legendary", "legendary_description", "Legendary"],
      ["villain_action", "is_villain", "villain_description", "Villain"],
      ["mythic_action", "is_mythic", "mythic_description", "Mythic"],
    ] as const;

    for (const [target, flag, description, label] of special) {
      const host = document.createElement("div");
      document.body.append(host);
      const component = mount(ActionSectionEditor, {
        target: host,
        props: { target, sectionTitle: label, specialFlagKey: flag, introDescriptionKey: description },
      });
      flushSync();

      const section = host.querySelector(".action-section");
      expect(section?.querySelector(`#${target}-enabled`)).not.toBeNull();
      expect(section?.querySelector(`#${target}-intro`)).not.toBeNull();
      expect(section?.querySelector("[data-repeatable-add]")).not.toBeNull();
      expect(section?.querySelector(".action-section__special-header + .field + .repeatable")).not.toBeNull();
      if (target === "villain_action") {
        expect(section?.querySelector(`[aria-label="${label} information"]`)).not.toBeNull();
      } else {
        expect(section?.querySelector(`[aria-label="${label} information"]`)).toBeNull();
      }

      unmount(component);
      host.remove();
    }
  });

  it("preserves special flags and descriptions when the monster is replaced", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const component = mount(ActionSectionEditor, {
      target: host,
      props: { target: "villain_action", sectionTitle: "Villain", specialFlagKey: "is_villain", introDescriptionKey: "villain_description" },
    });

    replaceMonster({ ...createDefaultMonster(), is_villain: true, villain_description: "Keep this introduction." });
    flushSync();

    expect((host.querySelector("#villain_action-enabled") as HTMLInputElement).checked).toBe(true);
    expect((host.querySelector("#villain_action-intro") as HTMLTextAreaElement).value).toBe("Keep this introduction.");
    monster.update((current) => ({ ...current, name: "Unrelated update" }));
    flushSync();
    expect((host.querySelector("#villain_action-enabled") as HTMLInputElement).checked).toBe(true);
    expect((host.querySelector("#villain_action-intro") as HTMLTextAreaElement).value).toBe("Keep this introduction.");

    unmount(component);
    host.remove();
  });
});
