// @vitest-environment jsdom

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import StatBlockPreview from '../../src/lib/components/preview/StatBlockPreview.svelte';
import StatBlock from '../../src/lib/components/preview/StatBlock.svelte';
import PreviewField from '../../src/lib/components/preview/PreviewField.svelte';
import { createPreviewModel } from '../../src/lib/monster/preview';
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
let additionalMounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (additionalMounted) unmount(additionalMounted);
	additionalMounted = undefined;
	if (mounted) unmount(mounted);
	mounted = undefined;
	document.body.innerHTML = '';
	resetMonster();
});

describe('StatBlockPreview', () => {
	it('renders the reusable stat block presentation', () => {
		const model = createPreviewModel(dragon);
		mounted = mount(StatBlock, {
			target: document.body,
			props: { preview: model, theme: 'monster-manual-smooth', idPrefix: 'direct-preview' },
		});
		flushSync();

		const article = document.querySelector<HTMLElement>('article.stat-block');
		expect(article?.getAttribute('data-stat-block-theme'))
			.toBe('monster-manual-smooth');
		expect(article?.style.getPropertyValue('--preview-title')).toBe('#922610');
		expect(article?.style.getPropertyValue('--preview-action-name')).toBe('#000000');
		expect(article?.classList.contains('stat-block--two-column')).toBe(false);
		expect(article?.querySelector('.stat-block__body')).toBeNull();
		expect(article?.querySelector(':scope > .stat-block__fields')).not.toBeNull();
		expect(article?.querySelector(':scope > .stat-block__challenge')).not.toBeNull();
		expect(article?.querySelector(':scope > .stat-block__rule--thin')).not.toBeNull();
		expect(article?.querySelector(':scope > .preview-section')).not.toBeNull();
		expect(document.querySelector('.stat-block h2')?.textContent).toContain('Ancient Red Dragon');
		expect(document.querySelector('.stat-block__abilities')).not.toBeNull();
		expect(document.querySelector('.preview-section h3')?.textContent).toBe('Actions');
	});

	it('marks two-column stat blocks and wraps only lower-flow content', () => {
		const model = createPreviewModel(dragon);
		mounted = mount(StatBlock, {
			target: document.body,
			props: { preview: model, theme: 'monster-manual-smooth', idPrefix: 'two-column-preview', twoColumn: true },
		});
		flushSync();

		const article = document.querySelector<HTMLElement>('article.stat-block');
		const body = article?.querySelector<HTMLElement>('.stat-block__body');
		expect(article).not.toBeNull();
		expect(article?.classList.contains('stat-block--two-column')).toBe(true);
		expect(body).not.toBeNull();
		expect(article?.querySelector(':scope > .stat-block__body')).toBe(body);
		expect(body?.querySelector('.stat-block__fields')).not.toBeNull();
		expect(body?.querySelector('.stat-block__challenge')).not.toBeNull();
		expect(body?.querySelector('.stat-block__rule--thin')).not.toBeNull();
		expect(body?.querySelector('.preview-section')).not.toBeNull();
		expect(body?.querySelector('.stat-block__abilities')).toBeNull();
		expect(body?.previousElementSibling?.classList.contains('stat-block__rule')).toBe(true);
	});

	it('keeps stat block accessibility references unique per instance', () => {
		const model = createPreviewModel(dragon);
		const liveTarget = document.createElement('div');
		const exportTarget = document.createElement('div');
		document.body.append(liveTarget, exportTarget);
		mounted = mount(StatBlock, {
			target: liveTarget,
			props: { preview: model, theme: 'monster-manual-smooth', idPrefix: 'live-preview' },
		});
		additionalMounted = mount(StatBlock, {
			target: exportTarget,
			props: { preview: model, theme: 'monster-manual-smooth', idPrefix: 'export-preview' },
		});
		flushSync();

		const articles = [...document.querySelectorAll('article.stat-block')];
		const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
		expect(new Set(ids).size).toBe(ids.length);

		for (const article of articles) {
			const labelledBy = article.getAttribute('aria-labelledby');
			expect(labelledBy).not.toBeNull();
			expect(article.querySelector(`[id="${labelledBy}"]`)).not.toBeNull();

			for (const cell of article.querySelectorAll('td[headers]')) {
				for (const headerId of cell.getAttribute('headers')?.split(/\s+/) ?? []) {
					expect(article.querySelector(`[id="${headerId}"]`)).not.toBeNull();
				}
			}

			for (const section of article.querySelectorAll('section[aria-labelledby]')) {
				const headingId = section.getAttribute('aria-labelledby');
				expect(article.querySelector(`[id="${headingId}"]`)).not.toBeNull();
			}
		}
	});

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

	it('threads the persisted two-column preference to the live preview', () => {
		mounted = mount(StatBlockPreview, { target: document.body, props: { monster: { ...dragon, two_column: true } } });
		flushSync();

		expect(document.querySelector('article.stat-block')?.classList.contains('stat-block--two-column')).toBe(true);
	});

	it('falls back to a non-empty accessible name', () => {
		mounted = mount(StatBlockPreview, { target: document.body, props: { monster: normalizeMonster({ name: '   ' }) } });
		flushSync();

		const heading = document.querySelector('#live-preview-stat-block-name');
		expect(heading?.textContent).toBe('Monster');
		expect(document.querySelector('article.stat-block')?.getAttribute('aria-labelledby')).toBe('live-preview-stat-block-name');
	});

	it('forwards a custom ID prefix to the rendered stat block', () => {
		mounted = mount(StatBlockPreview, {
			target: document.body,
			props: { monster: dragon, idPrefix: 'custom-preview' },
		});
		flushSync();

		expect(document.querySelector('article.stat-block')?.getAttribute('aria-labelledby')).toBe('custom-preview-stat-block-name');
		expect(document.querySelector('#custom-preview-stat-block-name')?.textContent).toContain('Ancient Red Dragon');
	});

	it('uses a custom ID prefix for preview errors', () => {
		mounted = mount(StatBlockPreview, {
			target: document.body,
			props: {
				idPrefix: 'custom-preview',
				createModel: () => { throw new Error('custom preview failure'); },
			},
		});
		flushSync();

		const error = document.querySelector<HTMLElement>('.preview-error');
		expect(error?.getAttribute('aria-labelledby')).toBe('custom-preview-error-heading');
		expect(document.querySelector('#custom-preview-error-heading')?.textContent).toBe('Preview could not be rendered');
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
