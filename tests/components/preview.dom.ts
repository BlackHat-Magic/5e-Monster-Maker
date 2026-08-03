// @vitest-environment jsdom

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import StatBlockPreview from '../../src/lib/components/preview/StatBlockPreview.svelte';
import PreviewField from '../../src/lib/components/preview/PreviewField.svelte';
import { normalizeMonster } from '../../src/lib/monster/defaults';
import { replaceMonster, resetMonster } from '../../src/lib/state/monster-store';
import PreviewWorkspaceTestWrapper from './PreviewWorkspaceTestWrapper.svelte';
import type { Monster } from '../../src/lib/monster/types';

const dragon: Monster = normalizeMonster({
	name: 'Ancient Red Dragon',
	shortened_name: 'dragon',
	basics: {
		size: 'gargantuan',
		type: 'dragon',
		tag: 'fire',
		alignment: 'chaotic evil',
		flavor: 'A terrible flame-breathing dragon.',
	},
	stats: {
		base_ac: 22,
		armor: 'natural armor',
		hit_dice: 28,
		speed: [40, 0, 40, 80, 0],
		ability_scores: [30, 10, 29, 18, 15, 23],
	},
	proficiencies: {
		saves: ['str', 'wis'],
		skills: ['perception', 'stealth'],
		expertise: ['perception'],
		senses: [60, 120, 0, 0, 30],
		challenge: 24,
	},
	is_legendary: true,
	is_villain: true,
	is_mythic: true,
	legendary_description: '**The dragon** has a legendary introduction.\n\n- One option.',
	villain_description: 'The dragon has a villain introduction.',
	mythic_description: 'The dragon has a mythic introduction.',
	ability: [{ name: 'Trait', description: '{{MON}} knows the old ways.\n\n- **Safe**\n- <img src="x" onerror="alert(1)">' }],
	action: [{ name: 'Claw', preset: 'attack', reach: 5, die_count: 2, die_size: 6, damage_type: 'slashing', recharge_min: 5 }],
	bonus_action: [{ name: 'Bonus', description: '{{MON}} uses a bonus action.' }],
	reaction: [{ name: 'Reaction', description: '{{MON}} reacts.' }],
	legendary_action: [{ name: 'Legendary', description: '{{MON}} takes a legendary action.' }],
	villain_action: [{ name: 'Villain', description: '{{MON}} takes a villain action.' }],
	mythic_action: [{ name: 'Mythic', description: '{{MON}} takes a mythic action.' }],
});

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) unmount(mounted);
	mounted = undefined;
	document.body.innerHTML = '';
	resetMonster();
});

describe('StatBlockPreview', () => {
	it('starts with a neutral loading state before client mount work runs', () => {
		mounted = mount(StatBlockPreview, { target: document.body, props: { monster: dragon } });

		expect(document.querySelector('.preview-loading')).not.toBeNull();
		expect(document.querySelector('.preview-error')).toBeNull();

		flushSync();
		expect(document.querySelector('article.stat-block')).not.toBeNull();
	});

	it('mounts the production preview with semantic stat-block content', () => {
		mounted = mount(StatBlockPreview, { target: document.body, props: { monster: dragon } });
		flushSync();

		const article = document.querySelector('article.stat-block');
		expect(article).not.toBeNull();
		expect(article?.querySelector('h2')?.textContent).toContain('Ancient Red Dragon');
		expect(article?.querySelector('.stat-block__meta em')?.textContent).toBe('gargantuan dragon (fire), chaotic evil');
		expect(article?.textContent).toContain('Armor Class 22 (natural armor)');
		expect(article?.textContent).toContain('Hit Points 546 (28d20 + 252)');
		expect([...document.querySelectorAll('.preview-abilities__table thead th')].map((header) => header.textContent)).toEqual(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
		expect(article?.textContent).toContain('Challenge 24 (62,000 XP)');
		expect(article?.textContent).toContain('Proficiency Bonus +7');
		expect(article?.querySelector('h3')?.textContent).toBe('Actions');
		expect(article?.textContent).toContain('Bonus Actions');
		expect(article?.textContent).toContain('Reactions');
		expect(article?.textContent).toContain('Legendary Actions');
		expect(article?.textContent).toContain('Villain Actions');
		expect(article?.textContent).toContain('Mythic Actions');
		expect(article?.textContent).toContain('The dragon knows the old ways.');
		expect(article?.querySelector('.preview-section__intro ul')?.textContent).toContain('One option.');
		expect(article?.textContent).toContain('Melee Weapon Attack:');
		expect(article?.textContent).toContain('+17 to hit');
		expect(article?.textContent).toContain('17 (2d6 + 10) slashing damage');
		expect(article?.textContent).toContain('Recharge 5–6');
		expect(article?.innerHTML).not.toContain('onerror');
		const emphasizedName = [...(article?.querySelectorAll('.preview-action strong, .preview-action em') ?? [])]
			.find((element) => element.textContent?.includes('Claw'));
		expect(emphasizedName?.textContent).toContain('Claw');
		expect(emphasizedName?.textContent).toContain('Recharge 5–6');
	});

	it('falls back to a non-empty accessible name', () => {
		mounted = mount(StatBlockPreview, { target: document.body, props: { monster: normalizeMonster({ name: '   ' }) } });
		flushSync();

		const heading = document.querySelector('#stat-block-name');
		expect(heading?.textContent).toBe('Monster');
		expect(document.querySelector('article.stat-block')?.getAttribute('aria-labelledby')).toBe('stat-block-name');
	});

	it('keeps block HTML from creating nested paragraphs in preview fields', () => {
		mounted = mount(PreviewField, {
			target: document.body,
			props: { field: { label: 'Notes', value: 'details', markdown: '', html: '<p><strong>Notes</strong> details</p><ul><li>One</li></ul>' } },
		});
		flushSync();

		const field = document.querySelector('.preview-field');
		expect(field?.querySelector(':scope > p')).not.toBeNull();
		expect(field?.querySelector(':scope > p .preview-field')).toBeNull();
		expect(field?.querySelector('strong')?.textContent).toBe('Notes');
	});

	it('updates from the live normalized monster store', () => {
		mounted = mount(StatBlockPreview, { target: document.body });
		replaceMonster(dragon);
		flushSync();
		expect(document.querySelector('h2')?.textContent).toContain('Ancient Red Dragon');

		replaceMonster({ ...dragon, name: 'Ashen Wyrm' });
		flushSync();
		expect(document.querySelector('h2')?.textContent).toContain('Ashen Wyrm');
	});

	it('shows a themed error while the editor workspace remains mounted', () => {
		mounted = mount(PreviewWorkspaceTestWrapper, {
			target: document.body,
			props: { factory: () => { throw new Error('synthetic preview failure'); } },
		});
		flushSync();

		expect(document.querySelector('[role="alert"]')?.textContent).toContain('synthetic preview failure');
		expect(document.querySelector('.editor-workspace__form')).not.toBeNull();
		expect(document.querySelector('#test-editor-control')).not.toBeNull();
	});
});
