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

describe("action editor native DOM shell", () => {
  it("mounts and unmounts every action section target with its empty state", () => {
    for (const target of ACTION_ARRAY_KEYS) {
      const host = document.createElement("div");
      document.body.append(host);
      const component = mount(ActionSectionEditor, {
        target: host,
        props: { target, sectionTitle: target },
      });
      flushSync();

      expect(host.querySelector(`section[aria-label="${target}"]`)).not.toBeNull();
      expect(host.querySelector(".repeatable__empty")).not.toBeNull();
      unmount(component);
      expect(host.innerHTML).toBe("");
      host.remove();
    }
  });
});
