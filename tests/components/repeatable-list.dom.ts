// @vitest-environment jsdom

import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import RepeatableListTestWrapper from "./RepeatableListTestWrapper.svelte";
import { createDefaultMonster } from "../../src/lib/monster/defaults";
import { replaceMonster } from "../../src/lib/state/monster-store";

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = "";
});

describe("RepeatableList", () => {
	function outerRows(): HTMLElement[] {
		const list = document.querySelector<HTMLElement>('[aria-label="Outer items"]');
		const items = list?.querySelector<HTMLElement>('.repeatable__items');
		return Array.from(items?.children ?? []).filter((child): child is HTMLElement => child instanceof HTMLElement);
	}

	function outerLiveStatus(): HTMLElement | null {
		const list = document.querySelector<HTMLElement>('[aria-label="Outer items"]');
		return Array.from(list?.children ?? []).find((child) => child instanceof HTMLElement && child.matches('[data-repeatable-live-status]')) as HTMLElement | undefined ?? null;
	}

	function keyEvent(key: string): KeyboardEvent {
		return new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
	}

	it("restores focus to the modified outer list when nested rows share the target index", async () => {
    mounted = mount(RepeatableListTestWrapper, { target: document.body });
    flushSync();

    document.querySelector<HTMLButtonElement>('[aria-label="Remove Outer one"]')?.click();
    flushSync();
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.activeElement?.getAttribute("aria-label")).toBe("Outer two, item 1 of 1");
    expect(document.activeElement?.closest('[aria-label="Outer items"]')).not.toBeNull();
		expect(document.activeElement?.closest('[aria-label="Nested items"]')).toBeNull();
	});

	it("hides collapsed bodies and keeps collapse state with a reordered key", async () => {
		mounted = mount(RepeatableListTestWrapper, { target: document.body });
		flushSync();

		let rows = outerRows();
		const collapse = rows[0].querySelector<HTMLButtonElement>('[data-repeatable-collapse]')!;
		collapse.click();
		flushSync();
		const collapsedBody = rows[0].querySelector<HTMLElement>('.repeatable__body');
		expect(collapsedBody).not.toBeNull();
		expect(collapsedBody?.hasAttribute("hidden")).toBe(true);
		expect(collapse.getAttribute("aria-expanded")).toBe("false");
		expect(rows[0].querySelector('[aria-label="Expand Outer one"]')).not.toBeNull();

		collapse.click();
		flushSync();
		expect(collapsedBody?.hasAttribute("hidden")).toBe(false);
		expect(collapse.getAttribute("aria-expanded")).toBe("true");
		collapse.click();
		flushSync();

		const handle = rows[0].querySelector<HTMLButtonElement>('[data-repeatable-drag-handle]')!;
		handle.focus();
		handle.dispatchEvent(keyEvent(" "));
		flushSync();
		handle.dispatchEvent(keyEvent("ArrowDown"));
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));
		flushSync();

		rows = outerRows();
		expect(outerLiveStatus()?.textContent?.trim()).toBe("Outer one is at position 2. Press Space to drop or Escape to cancel.");
		expect(rows[1].getAttribute("aria-label")).toBe("Outer one, item 2 of 2");
		expect(rows[1].querySelector('[aria-label="Expand Outer one"]')).not.toBeNull();
		rows[1].querySelector<HTMLButtonElement>('[data-repeatable-drag-handle]')?.dispatchEvent(keyEvent(" "));
		flushSync();
	});

	it("reorders a grabbed item with the keyboard and restores it on Escape", async () => {
		mounted = mount(RepeatableListTestWrapper, { target: document.body });
		flushSync();

		const firstHandle = outerRows()[0].querySelector<HTMLButtonElement>('[data-repeatable-drag-handle]')!;
		firstHandle.focus();
		firstHandle.dispatchEvent(keyEvent(" "));
		flushSync();
		expect(firstHandle.getAttribute("aria-pressed")).toBe("true");

		firstHandle.dispatchEvent(keyEvent("ArrowDown"));
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));
		flushSync();
		let rows = outerRows();
		expect(rows[0].getAttribute("aria-label")).toBe("Outer two, item 1 of 2");
		expect(document.activeElement).toBe(rows[1].querySelector('[data-repeatable-drag-handle]'));
		expect(outerLiveStatus()?.textContent?.trim()).toBeTruthy();

		(document.activeElement as HTMLButtonElement).dispatchEvent(keyEvent("Escape"));
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));
		flushSync();
		rows = outerRows();
		expect(rows[0].getAttribute("aria-label")).toBe("Outer one, item 1 of 2");
		expect(rows[1].getAttribute("aria-label")).toBe("Outer two, item 2 of 2");
		expect(document.activeElement).toBe(rows[0].querySelector('[data-repeatable-drag-handle]'));
	});

	it("announces the grabbed item after a keyboard move", async () => {
		mounted = mount(RepeatableListTestWrapper, { target: document.body });
		flushSync();

		const firstHandle = outerRows()[0].querySelector<HTMLButtonElement>('[data-repeatable-drag-handle]')!;
		firstHandle.focus();
		firstHandle.dispatchEvent(keyEvent(" "));
		flushSync();
		firstHandle.dispatchEvent(keyEvent("ArrowDown"));
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));
		flushSync();

		expect(outerLiveStatus()?.textContent?.trim()).toBe("Outer one is at position 2. Press Space to drop or Escape to cancel.");
	});

	it("keeps same-length external replacements when they arrive before the local keyboard echo", async () => {
		mounted = mount(RepeatableListTestWrapper, {
			target: document.body,
			props: {
				replacementItems: [
					{ name: "External one", nested: [] },
					{ name: "External two", nested: [] },
				],
			},
		});
		flushSync();

		const firstHandle = outerRows()[0].querySelector<HTMLButtonElement>('[data-repeatable-drag-handle]')!;
		firstHandle.focus();
		firstHandle.dispatchEvent(keyEvent(" "));
		flushSync();
		firstHandle.dispatchEvent(keyEvent("ArrowDown"));
		document.querySelector<HTMLButtonElement>('[data-testid="replace-outer-items"]')?.click();
		flushSync();

		const replacementHandle = outerRows()[0].querySelector<HTMLButtonElement>('[data-repeatable-drag-handle]')!;
		replacementHandle.focus();
		replacementHandle.dispatchEvent(keyEvent("Escape"));
		await tick();
		flushSync();

		expect(outerRows()[0].getAttribute("aria-label")).toBe("External one, item 1 of 2");
		expect(outerRows()[1].getAttribute("aria-label")).toBe("External two, item 2 of 2");
		expect(replacementHandle.getAttribute("aria-pressed")).toBe("false");
	});

	it("resets collapse and drag state when the monster replacement epoch changes", () => {
		mounted = mount(RepeatableListTestWrapper, { target: document.body });
		flushSync();

		const row = outerRows()[0];
		row.querySelector<HTMLButtonElement>('[data-repeatable-collapse]')?.click();
		flushSync();
		const handle = row.querySelector<HTMLButtonElement>('[data-repeatable-drag-handle]')!;
		handle.focus();
		handle.dispatchEvent(keyEvent(" "));
		flushSync();

		replaceMonster(createDefaultMonster());
		flushSync();

		expect(outerRows()[0].querySelector('[data-repeatable-collapse]')?.getAttribute("aria-expanded")).toBe("true");
		expect(outerRows()[0].querySelector('[data-repeatable-drag-handle]')?.getAttribute("aria-pressed")).toBe("false");
	});

	it("keeps nested reordering inside the nested list", async () => {
		mounted = mount(RepeatableListTestWrapper, { target: document.body });
		flushSync();

		const nested = document.querySelector<HTMLElement>('[aria-label="Nested items"]')!;
		const nestedRows = Array.from(nested.querySelector<HTMLElement>('.repeatable__items')!.children) as HTMLElement[];
		const nestedHandle = nestedRows[0].querySelector<HTMLButtonElement>('[data-repeatable-drag-handle]')!;
		nestedHandle.focus();
		nestedHandle.dispatchEvent(keyEvent(" "));
		nestedHandle.dispatchEvent(keyEvent("ArrowDown"));
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));
		flushSync();

		expect(outerRows()[0].getAttribute("aria-label")).toBe("Outer one, item 1 of 2");
		const reorderedNestedRows = Array.from(nested.querySelector<HTMLElement>('.repeatable__items')!.children) as HTMLElement[];
		expect(reorderedNestedRows[0].getAttribute("aria-label")).toBe("Nested alternate, item 1 of 2");
	});
});
