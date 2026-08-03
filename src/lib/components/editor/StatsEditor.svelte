<script lang="ts">
	import Field from './Field.svelte';
	import { monster, replacementEpoch } from '$lib/state/monster-store';
	import type { Monster } from '$lib/monster/types';
	import { ABILITY_KEYS, ABILITY_LABELS, shouldResyncNumericDraft, type NumericDraftField, validateNumericDraft } from './editor-core';
	const speedFields = [
		{ index: 0, label: 'Walk', field: 'speed.walk' },
		{ index: 1, label: 'Burrow', field: 'speed.burrow' },
		{ index: 2, label: 'Climb', field: 'speed.climb' },
		{ index: 3, label: 'Fly', field: 'speed.fly' },
		{ index: 4, label: 'Swim', field: 'speed.swim' },
	] as const;
	const numericFields: readonly NumericDraftField[] = [
		'base_ac', 'max_dex', 'hit_dice',
		'speed.walk', 'speed.burrow', 'speed.climb', 'speed.fly', 'speed.swim',
		'ability.str', 'ability.dex', 'ability.con', 'ability.int', 'ability.wis', 'ability.cha',
	];
	let drafts = $state<Partial<Record<NumericDraftField, string>>>({});
	let errors = $state<Partial<Record<NumericDraftField, string>>>({});
	const dirtyFields = new Set<NumericDraftField>();
	const lastExternalValues = new Map<NumericDraftField, number>();
	let focusedField: NumericDraftField | undefined;
	let lastReplacementEpoch: number | undefined;

	$effect(() => {
		const current = $monster;
		const epoch = $replacementEpoch;
		const replaced = lastReplacementEpoch !== undefined && lastReplacementEpoch !== epoch;
		if (replaced) {
			dirtyFields.clear();
			focusedField = undefined;
		}
		for (const field of numericFields) {
			const value = readNumericValue(current, field);
			if (replaced || shouldResyncNumericDraft(lastExternalValues.get(field), value, dirtyFields.has(field), focusedField === field)) {
				drafts[field] = String(value);
				delete errors[field];
			}
			lastExternalValues.set(field, value);
		}
		lastReplacementEpoch = epoch;
	});

	function readNumericValue(current: Monster, field: NumericDraftField): number {
		if (field === 'base_ac') return current.stats?.base_ac ?? 10;
		if (field === 'max_dex') return current.stats?.max_dex ?? -1;
		if (field === 'hit_dice') return current.stats?.hit_dice ?? 1;
		if (field.startsWith('speed.')) {
			const index = speedFields.findIndex((speed) => speed.field === field);
			return current.stats?.speed?.[index] ?? 0;
		}
		const index = ABILITY_KEYS.indexOf(field.slice('ability.'.length) as (typeof ABILITY_KEYS)[number]);
		return current.stats?.ability_scores?.[index] ?? 10;
	}

	function numericDraft(field: NumericDraftField): string {
		return drafts[field] ?? String(readNumericValue($monster, field));
	}

	function numericError(field: NumericDraftField): string {
		return errors[field] ?? '';
	}

	function updateNumeric(current: Monster, field: NumericDraftField, value: number): Monster {
		if (field === 'base_ac' || field === 'max_dex' || field === 'hit_dice') {
			return { ...current, stats: { ...current.stats, [field]: value } };
		}
		if (field.startsWith('speed.')) {
			const index = speedFields.findIndex((speed) => speed.field === field);
			const speed = [...(current.stats?.speed ?? [30, 0, 0, 0, 0])];
			speed[index] = value;
			return { ...current, stats: { ...current.stats, speed } };
		}
		const key = field.slice('ability.'.length) as (typeof ABILITY_KEYS)[number];
		const index = ABILITY_KEYS.indexOf(key);
		const abilityScores = [...(current.stats?.ability_scores ?? [10, 10, 10, 10, 10, 10])];
		abilityScores[index] = value;
		return { ...current, stats: { ...current.stats, ability_scores: abilityScores } };
	}

	function updateNumericDraft(field: NumericDraftField, event: Event): void {
		const raw = (event.currentTarget as HTMLInputElement).value;
		drafts[field] = raw;
		dirtyFields.add(field);
		const result = validateNumericDraft(field, raw);
		if (!result.valid) {
			errors[field] = result.error;
			return;
		}
		delete errors[field];
		monster.update((current) => updateNumeric(current, field, result.value));
	}

	function focusNumeric(field: NumericDraftField): void {
		focusedField = field;
	}

	function validateNumericBlur(field: NumericDraftField): void {
		focusedField = undefined;
		const result = validateNumericDraft(field, numericDraft(field));
		if (result.valid) {
			dirtyFields.delete(field);
			delete errors[field];
			return;
		}
		dirtyFields.add(field);
		errors[field] = result.error;
	}

	function updateArmor(event: Event): void {
		monster.update((current) => ({ ...current, stats: { ...current.stats, armor: (event.currentTarget as HTMLInputElement).value } }));
	}
</script>

<section class="editor-section" aria-labelledby="stats-heading">
	<div class="editor-section__intro">
		<p class="section-label">04 / Mechanics</p>
		<h2 id="stats-heading">Core stats</h2>
		<p>Set defensive math, movement, and the six ability scores in schema order.</p>
	</div>
	<div class="editor-grid editor-grid--three">
		<Field id="base-ac" label="Base AC" error={numericError('base_ac')}>
			{#snippet children(control)}<input class="editor-control" id="base-ac" type="text" inputmode="numeric" value={numericDraft('base_ac')} onfocus={() => focusNumeric('base_ac')} oninput={(event) => updateNumericDraft('base_ac', event)} onblur={() => validateNumericBlur('base_ac')} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
		<Field id="max-dex" label="Max Dex" description="Use -1 for no Dexterity cap." error={numericError('max_dex')}>
			{#snippet children(control)}<input class="editor-control" id="max-dex" type="text" inputmode="numeric" value={numericDraft('max_dex')} onfocus={() => focusNumeric('max_dex')} oninput={(event) => updateNumericDraft('max_dex', event)} onblur={() => validateNumericBlur('max_dex')} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
		<Field id="hit-dice" label="Hit dice" error={numericError('hit_dice')}>
			{#snippet children(control)}<input class="editor-control" id="hit-dice" type="text" inputmode="numeric" value={numericDraft('hit_dice')} onfocus={() => focusNumeric('hit_dice')} oninput={(event) => updateNumericDraft('hit_dice', event)} onblur={() => validateNumericBlur('hit_dice')} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
	</div>
	<div class="editor-grid editor-grid--two">
		<Field id="armor" label="Armor">
			{#snippet children(control)}<input class="editor-control" id="armor" type="text" value={$monster.stats?.armor ?? ''} oninput={updateArmor} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
		<label class="editor-check-card editor-check-card--inline"><input type="checkbox" checked={$monster.stats?.add_dex ?? false} onchange={(event) => monster.update((current) => ({ ...current, stats: { ...current.stats, add_dex: (event.currentTarget as HTMLInputElement).checked } }))} /><span>Add Dexterity modifier</span><small>Include DEX in AC calculation.</small></label>
	</div>

	<div class="editor-section__subhead"><span>Movement / ft.</span><i></i></div>
	<div class="editor-grid editor-grid--five">
		{#each speedFields as speed}
			<Field id={`speed-${speed.label.toLowerCase()}`} label={speed.label} error={numericError(speed.field)}>
				{#snippet children(control)}<input class="editor-control" id={`speed-${speed.label.toLowerCase()}`} type="text" inputmode="numeric" value={numericDraft(speed.field)} onfocus={() => focusNumeric(speed.field)} oninput={(event) => updateNumericDraft(speed.field, event)} onblur={() => validateNumericBlur(speed.field)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
			</Field>
		{/each}
	</div>

	<div class="editor-section__subhead"><span>Ability scores / schema order</span><i></i></div>
	<div class="editor-grid editor-grid--six">
		{#each ABILITY_KEYS as key, index}
			<Field id={`ability-${key}`} label={key.toUpperCase()} description={ABILITY_LABELS[key]} error={numericError(`ability.${key}`)}>
				{#snippet children(control)}<input class="editor-control editor-control--score" id={`ability-${key}`} type="text" inputmode="numeric" value={numericDraft(`ability.${key}`)} onfocus={() => focusNumeric(`ability.${key}`)} oninput={(event) => updateNumericDraft(`ability.${key}`, event)} onblur={() => validateNumericBlur(`ability.${key}`)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
			</Field>
		{/each}
	</div>
</section>
