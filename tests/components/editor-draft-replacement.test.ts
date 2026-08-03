// @vitest-environment jsdom

import { flushSync, mount, unmount } from 'svelte';
import { beforeEach, describe, expect, it } from 'vitest';
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
