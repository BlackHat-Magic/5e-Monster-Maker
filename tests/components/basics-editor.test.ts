// @vitest-environment jsdom

import { flushSync, mount, unmount } from 'svelte';
import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import BasicsEditor from '../../src/lib/components/editor/BasicsEditor.svelte';
import { createDefaultMonster } from '../../src/lib/monster/defaults';
import { monster } from '../../src/lib/state/monster-store';

describe('BasicsEditor', () => {
	it('updates the persisted two-column preference from its checkbox', () => {
		monster.set(createDefaultMonster());
		const component = mount(BasicsEditor, { target: document.body });
		flushSync();

		const checkbox = document.querySelector<HTMLInputElement>('#monster-two-column');
		expect(checkbox).not.toBeNull();
		expect(checkbox?.checked).toBe(false);
		expect(document.querySelector('label[for="monster-two-column"]')?.textContent).toContain('Two-column stat block');

		checkbox?.click();
		flushSync();

		expect(checkbox?.checked).toBe(true);
		expect(get(monster).two_column).toBe(true);
		unmount(component);
	});
});
