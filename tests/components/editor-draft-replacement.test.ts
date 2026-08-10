// @vitest-environment jsdom

import { flushSync, mount, unmount } from 'svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import ActionSectionEditor from '../../src/lib/components/editor/ActionSectionEditor.svelte';
import StatsEditor from '../../src/lib/components/editor/StatsEditor.svelte';
import ProficienciesEditor from '../../src/lib/components/editor/ProficienciesEditor.svelte';
import { createDefaultMonster } from '../../src/lib/monster/defaults';
import { monster, replaceMonster, resetMonster } from '../../src/lib/state/monster-store';

function dispatchInput(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

beforeEach(() => {
  document.body.innerHTML = '';
  resetMonster();
});

describe('StatsEditor draft replacement behavior', () => {
  it('clears an invalid draft and error when replacing with the same values', () => {
    const component = mount(StatsEditor, { target: document.body });
    flushSync();
    const input = document.querySelector('#base-ac') as HTMLInputElement;

    dispatchInput(input, '12x');
    expect(input.value).toBe('12x');
    expect(document.body.textContent).toContain('Use a whole number.');

    replaceMonster(createDefaultMonster());
    flushSync();

    expect(input.value).toBe('10');
    expect(document.body.textContent).not.toContain('Use a whole number.');
    unmount(component);
  });

  it('preserves an invalid draft through an unrelated monster update', () => {
    const component = mount(StatsEditor, { target: document.body });
    flushSync();
    const input = document.querySelector('#base-ac') as HTMLInputElement;

    dispatchInput(input, '12x');
    monster.update((current) => ({ ...current, name: 'Unrelated edit' }));
    flushSync();

    expect(input.value).toBe('12x');
    expect(document.body.textContent).toContain('Use a whole number.');
    unmount(component);
  });
});

describe('ProficienciesEditor draft replacement behavior', () => {
  it('clears an invalid draft and error when replacing with the same values', () => {
    const component = mount(ProficienciesEditor, { target: document.body });
    flushSync();
    const input = document.querySelector('#sense-blindsight') as HTMLInputElement;

    dispatchInput(input, '12x');
    expect(input.value).toBe('12x');
    expect(document.body.textContent).toContain('Use zero or a positive whole number.');

    replaceMonster(createDefaultMonster());
    flushSync();

    expect(input.value).toBe('0');
    expect(document.body.textContent).not.toContain('Use zero or a positive whole number.');
    unmount(component);
  });

  it('preserves an invalid draft through an unrelated monster update', () => {
    const component = mount(ProficienciesEditor, { target: document.body });
    flushSync();
    const input = document.querySelector('#sense-blindsight') as HTMLInputElement;

    dispatchInput(input, '12x');
    monster.update((current) => ({ ...current, name: 'Unrelated edit' }));
    flushSync();

    expect(input.value).toBe('12x');
    expect(document.body.textContent).toContain('Use zero or a positive whole number.');
    unmount(component);
  });
});

describe('ActionCard draft replacement behavior', () => {
  it('preserves an invalid draft through normalized edits and clears it on replacement', () => {
    const component = mount(ActionSectionEditor, {
      target: document.body,
      props: { target: 'action', sectionTitle: 'Actions' },
    });
    replaceMonster({
      ...createDefaultMonster(),
      action: [
        { name: 'Action A', preset: 'attack' },
        { name: 'Action B', preset: 'attack' },
      ],
    });
    flushSync();

    const reach = document.querySelector('#action-action-0-attack-reach') as HTMLInputElement;
    dispatchInput(reach, '12x');
    expect(reach.getAttribute('aria-invalid')).toBe('true');

    const actionBName = document.querySelector('#action-action-1-name-field') as HTMLInputElement;
    dispatchInput(actionBName, 'Edited action B');

    expect(reach.value).toBe('12x');
    expect(reach.getAttribute('aria-invalid')).toBe('true');

    replaceMonster({
      ...createDefaultMonster(),
      action: [
        { name: 'Action A', preset: 'attack' },
        { name: 'Edited action B', preset: 'attack' },
      ],
    });
    flushSync();

    expect(reach.value).toBe('');
    expect(reach.getAttribute('aria-invalid')).toBe('false');
    unmount(component);
  });
});
