// @vitest-environment jsdom

import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CanonicalSelectorTestWrapper from './CanonicalSelectorTestWrapper.svelte';

let mounted: ReturnType<typeof mount> | undefined;

async function settle(): Promise<void> {
  await tick();
  await tick();
  flushSync();
}

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.replaceChildren();
});

describe('CanonicalSelector', () => {
  it('focuses Other, keeps focus after a custom add, renders a chip, and removes it accessibly', async () => {
    mounted = mount(CanonicalSelectorTestWrapper, { target: document.body });
    flushSync();

    const select = document.getElementById('canonical-damage-damage-resistances') as HTMLSelectElement;
    select.value = '__other__';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();

    const customInput = document.querySelector<HTMLInputElement>('input[aria-label="Custom damage resistances"]');
    expect(customInput).not.toBeNull();
    expect(document.activeElement).toBe(customInput);
    customInput!.value = '  shadow damage  ';
    customInput!.dispatchEvent(new Event('input', { bubbles: true }));
    customInput!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();

    expect(document.querySelector('.canonical-selector__chip')?.textContent).toContain('shadow damage');
    expect(document.activeElement).toBe(customInput);
    const remove = document.querySelector<HTMLButtonElement>('[aria-label="Remove shadow damage"]');
    expect(remove).not.toBeNull();
    remove!.click();
    flushSync();

    expect(document.querySelector('[aria-label="Remove shadow damage"]')).toBeNull();
    expect(document.querySelector('.canonical-selector__empty')?.textContent).toContain('No damage resistances selected');
  });

  it('rejects empty and duplicate Other values with described errors', async () => {
    mounted = mount(CanonicalSelectorTestWrapper, { target: document.body });
    flushSync();

    const select = document.getElementById('canonical-damage-damage-resistances') as HTMLSelectElement;
    select.value = '__other__';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const customInput = document.querySelector<HTMLInputElement>('input[aria-label="Custom damage resistances"]')!;
    document.querySelector<HTMLButtonElement>('.canonical-selector__custom button')!.click();
    await settle();

    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Enter a value before adding.');
    expect(customInput.getAttribute('aria-describedby')).toBe('canonical-damage-damage-resistances-custom-error');
    expect(document.activeElement).toBe(customInput);

    customInput.value = 'fire';
    customInput.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector<HTMLButtonElement>('.canonical-selector__custom button')!.click();
    await settle();
    expect(document.querySelector('[role="alert"]')?.textContent).toBeUndefined();

    customInput.value = ' FIRE ';
    customInput.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector<HTMLButtonElement>('.canonical-selector__custom button')!.click();
    await settle();
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('That value is already selected.');
    expect(customInput.getAttribute('aria-describedby')).toBe('canonical-damage-damage-resistances-custom-error');
  });
});
