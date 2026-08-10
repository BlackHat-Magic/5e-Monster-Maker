// @vitest-environment jsdom

import { flushSync, mount, tick, unmount } from 'svelte';
import { get } from 'svelte/store';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import FieldHelp from '../../src/lib/components/editor/FieldHelp.svelte';
import IdentityEditor from '../../src/lib/components/editor/IdentityEditor.svelte';
import StatsEditor from '../../src/lib/components/editor/StatsEditor.svelte';
import { createDefaultMonster } from '../../src/lib/monster/defaults';
import { hasPendingEditorDraft } from '../../src/lib/state/editor-draft-store';
import { monster } from '../../src/lib/state/monster-store';

afterEach(() => {
	document.body.replaceChildren();
	vi.useRealTimers();
});

beforeAll(() => {
	const requestAnimationFrame = (callback: FrameRequestCallback): number => setTimeout(() => callback(performance.now()), 0);
	const cancelAnimationFrame = (handle: number): void => clearTimeout(handle);
	globalThis.requestAnimationFrame = requestAnimationFrame;
	globalThis.cancelAnimationFrame = cancelAnimationFrame;
	window.requestAnimationFrame = requestAnimationFrame;
	window.cancelAnimationFrame = cancelAnimationFrame;
});

function trigger(): HTMLButtonElement {
	return document.querySelector<HTMLButtonElement>('[aria-label="Armor Class information"]') as HTMLButtonElement;
}

function content(): HTMLElement | null {
	return document.querySelector<HTMLElement>('.field-help__content');
}

async function settle(): Promise<void> {
	await tick();
	await tick();
	flushSync();
}

describe('FieldHelp', () => {
	it('renders one portaled help node with accessible label semantics and no tooltip text', async () => {
		const component = mount(FieldHelp, {
			target: document.body,
			props: { id: 'armor-help', label: 'Armor Class', help: 'Accessible help.' },
		});
		await settle();

		expect(document.querySelectorAll('.field-help__content')).toHaveLength(1);
		expect(document.body.textContent).not.toContain('Help for');
		expect(trigger().getAttribute('aria-label')).toBe('Armor Class information');
		expect(trigger().getAttribute('aria-describedby')).toBe('armor-help');
		expect(document.getElementById('armor-help')).toBe(content());
		expect(content()?.textContent).toContain('Accessible help.');
		expect(content()?.textContent).not.toContain('Armor Class');
		unmount(component);
	});

	it('keeps auto-generated content ids unique across mounted panels', async () => {
		const first = mount(FieldHelp, { target: document.body, props: { label: 'Repeated', help: 'First help.' } });
		const second = mount(FieldHelp, { target: document.body, props: { label: 'Repeated', help: 'Second help.' } });
		await settle();
		const ids = [...document.querySelectorAll<HTMLElement>('.field-help__content')].map((element) => element.id);

		expect(new Set(ids)).toHaveLength(2);
		expect(document.querySelectorAll('[aria-describedby]').length).toBe(2);
		unmount(first);
		unmount(second);
	});

	it('opens from keyboard focus and exposes rich help content and links', async () => {
		const component = mount(FieldHelp, {
			target: document.body,
			props: {
				id: 'armor-help',
				label: 'Armor Class',
				help: 'The defensive value used by attacks.',
				link: { href: 'https://example.com/rules', label: 'Read the rules' },
			},
		});

		trigger().focus();
		await settle();
		expect(content()).not.toBeNull();
		expect(content()?.textContent).toContain('The defensive value used by attacks.');
		expect(content()?.querySelector('a')?.getAttribute('href')).toBe('https://example.com/rules');
		unmount(component);
	});

	it('opens on click, closes with Escape and restores focus to the trigger', async () => {
		const component = mount(FieldHelp, { target: document.body, props: { id: 'armor-help', label: 'Armor Class', help: 'Click help.' } });
		const button = trigger();

		button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
		button.focus();
		button.click();
		await settle();
		expect(content()).not.toBeNull();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();
		expect(content()?.getAttribute('data-state')).toBe('closed');
		expect(document.activeElement).toBe(button);
		unmount(component);
	});

	it('keeps only the latest rapidly hovered help popover open', async () => {
		const first = mount(FieldHelp, { target: document.body, props: { id: 'first-help', label: 'First', help: 'First help.' } });
		const second = mount(FieldHelp, { target: document.body, props: { id: 'second-help', label: 'Second', help: 'Second help.' } });
		await settle();
		const firstTrigger = document.querySelector<HTMLButtonElement>('[aria-label="First information"]') as HTMLButtonElement;
		const secondTrigger = document.querySelector<HTMLButtonElement>('[aria-label="Second information"]') as HTMLButtonElement;

		firstTrigger.dispatchEvent(new Event('pointerenter', { bubbles: true }));
		await settle();
		secondTrigger.dispatchEvent(new Event('pointerenter', { bubbles: true }));
		await settle();

		expect(document.querySelector('[data-field-help-content="first-help"]')?.getAttribute('data-state')).toBe('closed');
		expect(document.querySelector('[data-field-help-content="second-help"]')?.getAttribute('data-state')).toBe('open');
		unmount(first);
		unmount(second);
	});

	it('restores Escape focus only to the active help trigger', async () => {
		const first = mount(FieldHelp, { target: document.body, props: { id: 'first-help', label: 'First', help: 'First help.' } });
		const second = mount(FieldHelp, { target: document.body, props: { id: 'second-help', label: 'Second', help: 'Second help.' } });
		await settle();
		const firstTrigger = document.querySelector<HTMLButtonElement>('[aria-label="First information"]') as HTMLButtonElement;
		const secondTrigger = document.querySelector<HTMLButtonElement>('[aria-label="Second information"]') as HTMLButtonElement;

		firstTrigger.focus();
		await settle();
		secondTrigger.dispatchEvent(new Event('pointerenter', { bubbles: true }));
		await settle();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();

		expect(document.activeElement).toBe(secondTrigger);
		expect(document.querySelector('[data-field-help-content="first-help"]')?.getAttribute('data-state')).toBe('closed');
		expect(document.querySelector('[data-field-help-content="second-help"]')?.getAttribute('data-state')).toBe('closed');
		unmount(first);
		unmount(second);
	});

	it('closes when interaction occurs outside the help surface', async () => {
		const component = mount(FieldHelp, { target: document.body, props: { id: 'armor-help', label: 'Armor Class', help: 'Outside click help.' } });
		const button = trigger();
		button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
		button.focus();
		button.click();
		await settle();
		expect(content()).not.toBeNull();
		const outside = document.createElement('button');
		document.body.append(outside);
		outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		await settle();
		expect(content()?.getAttribute('data-state')).toBe('closed');
		unmount(component);
	});

	it('stays open while focus moves into help content, then closes when tabbing away', async () => {
		const component = mount(FieldHelp, {
			target: document.body,
			props: {
				id: 'armor-help',
				label: 'Armor Class',
				help: 'Focus help.',
				link: { href: 'https://example.com/rules', label: 'Read the rules' },
			},
		});
		const button = trigger();
		button.focus();
		await settle();
		content()?.querySelector('a')?.focus();
		await settle();
		expect(content()?.getAttribute('data-state')).toBe('open');

		const outside = document.createElement('button');
		document.body.append(outside);
		outside.focus();
		await settle();
		expect(content()?.getAttribute('data-state')).toBe('closed');
		unmount(component);
	});

	it('opens immediately on hover without changing layout flow', async () => {
		vi.useFakeTimers();
		const component = mount(FieldHelp, { target: document.body, props: { id: 'armor-help', label: 'Armor Class', help: 'Hover help.' } });
		trigger().dispatchEvent(new Event('pointerenter', { bubbles: true }));
		vi.runAllTimers();
		await settle();
		expect(content()).not.toBeNull();
		expect(getComputedStyle(content()?.parentElement as HTMLElement).position).toBe('absolute');
		unmount(component);
	});
});

describe('editor help explanations', () => {
	it('renders exactly one Proper Noun explanation', async () => {
		const component = mount(IdentityEditor, { target: document.body });
		await settle();

		const text = "When false, prose may use 'the' before shortened names. When true, the shortened name is treated as a proper noun.";
		expect([...document.querySelectorAll('.field-help__content')].filter((node) => node.textContent?.includes(text))).toHaveLength(1);
		expect(document.body.textContent).not.toContain('Controls articles and capitalization in generated prose.');
		unmount(component);
	});

	it('renders exactly one Add Dexterity explanation', async () => {
		const component = mount(StatsEditor, { target: document.body });
		await settle();

		expect(document.body.textContent).not.toContain('Include the Dexterity modifier in the Armor Class calculation.');
		expect(document.querySelector('[aria-label="Add Dexterity modifier information"]')).toBeNull();
		unmount(component);
	});

	it('hides Max Dex when Dexterity modifiers are disabled without losing its value', async () => {
		const initial = createDefaultMonster();
		monster.set({ ...initial, stats: { ...initial.stats, add_dex: true, max_dex: 4 } });
		const component = mount(StatsEditor, { target: document.body });
		await settle();

		const toggle = document.querySelector<HTMLInputElement>('.editor-check input');
		const maxDex = document.querySelector<HTMLInputElement>('#max-dex');
		expect(toggle?.checked).toBe(true);
		expect(maxDex?.value).toBe('4');

		toggle?.click();
		await settle();
		expect(document.querySelector('#max-dex')).toBeNull();
		expect(get(monster).stats?.max_dex).toBe(4);

		toggle?.click();
		await settle();
		expect(document.querySelector<HTMLInputElement>('#max-dex')?.value).toBe('4');
		unmount(component);
	});

	it('clears an invalid Max Dex draft when Dexterity modifiers are disabled', async () => {
		const initial = createDefaultMonster();
		monster.set({ ...initial, stats: { ...initial.stats, add_dex: true, max_dex: 4 } });
		const component = mount(StatsEditor, { target: document.body });
		await settle();

		const toggle = document.querySelector<HTMLInputElement>('.editor-check input');
		const maxDex = document.querySelector<HTMLInputElement>('#max-dex');
		maxDex?.focus();
		if (maxDex) {
			maxDex.value = '-2';
			maxDex.dispatchEvent(new Event('input', { bubbles: true }));
		}
		await settle();
		expect(maxDex?.value).toBe('-2');
		expect(document.body.textContent).toContain('Max Dex must be -1 or greater.');
		expect(hasPendingEditorDraft()).toBe(true);

		toggle?.click();
		await settle();
		expect(document.querySelector('#max-dex')).toBeNull();
		expect(get(monster).stats?.max_dex).toBe(4);
		expect(hasPendingEditorDraft()).toBe(false);

		toggle?.click();
		await settle();
		expect(document.querySelector<HTMLInputElement>('#max-dex')?.value).toBe('4');
		expect(document.body.textContent).not.toContain('Max Dex must be -1 or greater.');
		unmount(component);
	});
});
