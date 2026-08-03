// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { createDefaultMonster, normalizeMonster } from '../../src/lib/monster/defaults';
import {
	addLanguage,
	appendRepeatableKey,
	createRepeatableKeyState,
	EDITOR_PANEL_ID,
	EDITOR_SECTIONS,
	editorPanelId,
	editorTabId,
	moveLanguage,
	moveListItem,
	removeLanguage,
	removeListItem,
	repeatablePrimitiveKey,
	sectionNavigationTarget,
	shouldResyncNumericDraft,
	syncRepeatableKeys,
	updateAbilityScore,
	updateMonsterName,
	validateNumericDraft,
} from '../../src/lib/components/editor/editor-core';

describe('editor core helpers', () => {
	it('updates a monster name without losing empty strings', () => {
		const monster = createDefaultMonster();
		const updated = updateMonsterName(monster, '');

		expect(updated.name).toBe('');
		expect(monster.name).toBe('New Monster');
	});

	it('updates the schema-ordered ability score, including zero', () => {
		const monster = createDefaultMonster();
		const updated = updateAbilityScore(monster, 'dex', 0);

		expect(updated.stats?.ability_scores).toEqual([10, 0, 10, 10, 10, 10]);
		expect(monster.stats?.ability_scores).toEqual([10, 10, 10, 10, 10, 10]);
	});

	it('normalizes false, empty, zero, and negative-one values as valid data', () => {
		const normalized = normalizeMonster({
			name: '',
			proper_noun: false,
			is_legendary: false,
			basics: { flavor: '' },
			stats: { base_ac: 0, add_dex: false, max_dex: -1, ability_scores: [0, 0, 0, 0, 0, 0] },
		});

		expect(normalized.name).toBe('');
		expect(normalized.proper_noun).toBe(false);
		expect(normalized.basics?.flavor).toBe('');
		expect(normalized.stats).toMatchObject({ base_ac: 0, add_dex: false, max_dex: -1, ability_scores: [0, 0, 0, 0, 0, 0] });
	});

	it('adds, removes, and reorders language entries immutably', () => {
		const base = createDefaultMonster();
		const withCommon = addLanguage(base, { name: 'Common', status: 'speaks', but: '' });
		const withElvish = addLanguage(withCommon, { name: 'Elvish', status: 'understands' });
		const reordered = {
			...withElvish,
			language: moveLanguage(withElvish, 1, 0).language,
		};
		const removed = removeLanguage(reordered, 1);

		expect(base.language).toEqual([]);
		expect(reordered.language?.map((entry) => entry.name)).toEqual(['Elvish', 'Common']);
		expect(removed.language?.map((entry) => entry.name)).toEqual(['Elvish']);
	});

	it('keeps repeatable movement at the list boundaries', () => {
		const items = ['first', 'second', 'third'];

		expect(moveListItem(items, 0, -1)).toEqual(items);
		expect(moveListItem(items, 2, 3)).toEqual(items);
		expect(moveListItem(items, 1, 0)).toEqual(['second', 'first', 'third']);
		expect(items).toEqual(['first', 'second', 'third']);
	});

	it('navigates every section in rendered order across visual groups', () => {
		const sections = [
			'identity', 'features', 'basics', 'stats', 'proficiencies', 'language', 'traits', 'action', 'bonus_action', 'reaction', 'legendary_action', 'villain_action', 'mythic_action',
		].map((key) => ({ key }));

		expect(sectionNavigationTarget(sections, 'language', 'ArrowDown')?.key).toBe('traits');
		expect(sectionNavigationTarget(sections, 'traits', 'ArrowUp')?.key).toBe('language');
		expect(sectionNavigationTarget(sections, 'language', 'ArrowRight')?.key).toBe('traits');
		expect(sectionNavigationTarget(sections, 'traits', 'ArrowLeft')?.key).toBe('language');
		expect(sectionNavigationTarget(sections, 'mythic_action', 'ArrowDown')?.key).toBe('identity');
		expect(sectionNavigationTarget(sections, 'identity', 'ArrowUp')?.key).toBe('mythic_action');
		expect(sectionNavigationTarget(sections, 'mythic_action', 'Home')?.key).toBe('identity');
		expect(sectionNavigationTarget(sections, 'identity', 'End')?.key).toBe('mythic_action');
	});

	it('validates numeric drafts without coercing intermediate or invalid values', () => {
		expect(validateNumericDraft('base_ac', '').valid).toBe(false);
		expect(validateNumericDraft('base_ac', '12.5')).toMatchObject({ valid: false, error: 'Use a whole number.' });
		expect(validateNumericDraft('base_ac', '-2')).toMatchObject({ valid: false });
		expect(validateNumericDraft('base_ac', '0')).toEqual({ valid: true, value: 0 });
		expect(validateNumericDraft('max_dex', '-1')).toEqual({ valid: true, value: -1 });
		expect(validateNumericDraft('max_dex', '-2')).toMatchObject({ valid: false });
		expect(validateNumericDraft('ability.dex', '18')).toEqual({ valid: true, value: 18 });
	});

	it('preserves a dirty intermediate draft during unrelated updates', () => {
		expect(shouldResyncNumericDraft(12, 12, true, false)).toBe(false);
		expect(shouldResyncNumericDraft(12, 13, true, true)).toBe(true);
		expect(shouldResyncNumericDraft(12, 12, false, false)).toBe(true);
		expect(shouldResyncNumericDraft(12, 12, false, true)).toBe(false);
	});

	it('keeps object row keys stable through reorder and primitive keys safely positional', () => {
		const keyState = createRepeatableKeyState(2);
		const objectKeys = [...keyState.keys];

		expect(moveListItem(objectKeys, 1, 0)).toEqual([objectKeys[1], objectKeys[0]]);
		expect(repeatablePrimitiveKey(0)).not.toBe(repeatablePrimitiveKey(1));
		expect(new Set(keyState.keys)).toHaveLength(2);
	});

	it('synchronizes same-position edits and allocates unique keys for duplicate primitive rows', () => {
		const keyState = createRepeatableKeyState(2);
		const originalKeys = [...keyState.keys];

		syncRepeatableKeys(keyState, 3);
		appendRepeatableKey(keyState);

		expect(keyState.keys.slice(0, 2)).toEqual(originalKeys);
		expect(keyState.keys).toHaveLength(4);
		expect(new Set(['duplicate', 'duplicate'].map((_, index) => keyState.keys[index]))).toHaveLength(2);

		const reordered = moveListItem(keyState.keys, 2, 0);
		const removed = removeListItem(reordered, 1);
		expect(removed).toEqual([keyState.keys[2], keyState.keys[1], keyState.keys[3]]);
	});

	it('shares the rendered section order and linked tabpanel ids', () => {
		expect(EDITOR_SECTIONS).toHaveLength(13);
		expect(EDITOR_SECTIONS[1].key).toBe('features');
		expect(EDITOR_SECTIONS[5].key).toBe('language');
		expect(EDITOR_SECTIONS[6].key).toBe('traits');
		expect(EDITOR_SECTIONS[12].key).toBe('mythic_action');
		expect(editorTabId('stats')).toBe('section-tab-stats');
		expect(EDITOR_PANEL_ID).toBe('editor-panel');
		expect(editorPanelId()).toBe(EDITOR_PANEL_ID);
	});

	it('keeps Features as metadata editing and maps Traits to the ability action array', () => {
		const features = EDITOR_SECTIONS.find((section) => section.key === 'features');
		const traits = EDITOR_SECTIONS.find((section) => section.key === 'traits');

		expect(features).toMatchObject({ key: 'features', label: 'Features', editor: 'features' });
		expect(features?.actionTarget).toBeUndefined();
		expect(traits).toMatchObject({ key: 'traits', label: 'Traits', editor: 'actions', actionTarget: 'ability' });
		expect(EDITOR_SECTIONS.filter((section) => section.editor === 'actions').map((section) => section.actionTarget)).toEqual([
			'ability',
			'action',
			'bonus_action',
			'reaction',
			'legendary_action',
			'villain_action',
			'mythic_action',
		]);
	});
});

// Component rendering is intentionally not used here: the current Vitest +
// @testing-library/svelte mount adapter passes compiled Svelte 5 components to
// its legacy import unwrap path and throws before a DOM is created. Field.svelte
// remains accessible by construction: every consumer supplies the same id to
// Field and its native control, while Field emits the label, description/error
// ids, aria-describedby, and aria-invalid attributes. The pure update tests
// below cover the behavior that can be exercised without that adapter.
