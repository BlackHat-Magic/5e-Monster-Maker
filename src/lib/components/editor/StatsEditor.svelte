<script lang="ts">
	import { onDestroy } from 'svelte';
	import Field from './Field.svelte';
	import { monster, replacementEpoch } from '$lib/state/monster-store';
	import type { Monster } from '$lib/monster/types';
	import { ABILITY_KEYS, ABILITY_LABELS, shouldResyncNumericDraft, type NumericDraftField, validateNumericDraft } from './editor-core';
	import { clearEditorDraft, clearEditorDrafts, markEditorDraft } from '$lib/state/editor-draft-store';

	const draftOwner = 'stats-editor';
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

	onDestroy(() => clearEditorDrafts(draftOwner));

	$effect(() => {
		const current = $monster;
		const epoch = $replacementEpoch;
		const replaced = lastReplacementEpoch !== undefined && lastReplacementEpoch !== epoch;
		if (replaced) {
			dirtyFields.clear();
			focusedField = undefined;
			clearEditorDrafts(draftOwner);
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
			markEditorDraft(draftOwner, field);
			errors[field] = result.error;
			return;
		}
		clearEditorDraft(draftOwner, field);
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
			clearEditorDraft(draftOwner, field);
			dirtyFields.delete(field);
			delete errors[field];
			return;
		}
		dirtyFields.add(field);
		markEditorDraft(draftOwner, field);
		errors[field] = result.error;
	}

	function updateArmor(event: Event): void {
		monster.update((current) => ({ ...current, stats: { ...current.stats, armor: (event.currentTarget as HTMLInputElement).value } }));
	}

	function updateAddDex(event: Event): void {
		const addDex = (event.currentTarget as HTMLInputElement).checked;
		if (!addDex) {
			delete drafts.max_dex;
			delete errors.max_dex;
			dirtyFields.delete('max_dex');
			if (focusedField === 'max_dex') focusedField = undefined;
			clearEditorDraft(draftOwner, 'max_dex');
		}
		monster.update((current) => ({ ...current, stats: { ...current.stats, add_dex: addDex } }));
	}
</script>

	<section class="editor-section grid min-w-0 gap-[34px]" aria-labelledby="stats-heading">
	<div class="editor-section__intro grid gap-2.5">
		<h2 id="stats-heading" class="m-0 font-display text-[clamp(1.9rem,3.8vw,3.25rem)] leading-[0.96] tracking-[-0.08em]">Core stats</h2>
		<p class="m-0 max-w-[600px] text-[0.9rem] leading-[1.65] text-muted-foreground">Set defensive math, movement, and the six ability scores.</p>
	</div>
	<div class="editor-grid editor-grid--three grid min-w-0 gap-[22px] grid-cols-[repeat(3,minmax(0,1fr))] max-[500px]:grid-cols-1">
		<Field id="base-ac" label="Base AC" help="The creature's starting Armor Class before optional Dexterity or armor adjustments." error={numericError('base_ac')}>
			{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id="base-ac" type="text" inputmode="numeric" value={numericDraft('base_ac')} onfocus={() => focusNumeric('base_ac')} oninput={(event) => updateNumericDraft('base_ac', event)} onblur={() => validateNumericBlur('base_ac')} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
		{#if $monster.stats?.add_dex}
			<Field id="max-dex" label="Max Dex" help="The maximum Dexterity modifier applied to AC; use -1 for no cap." error={numericError('max_dex')}>
				{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id="max-dex" type="text" inputmode="numeric" value={numericDraft('max_dex')} onfocus={() => focusNumeric('max_dex')} oninput={(event) => updateNumericDraft('max_dex', event)} onblur={() => validateNumericBlur('max_dex')} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
			</Field>
		{/if}
		<Field id="hit-dice" label="Hit dice" help="The number of hit dice used to calculate hit points." error={numericError('hit_dice')}>
			{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id="hit-dice" type="text" inputmode="numeric" value={numericDraft('hit_dice')} onfocus={() => focusNumeric('hit_dice')} oninput={(event) => updateNumericDraft('hit_dice', event)} onblur={() => validateNumericBlur('hit_dice')} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
	</div>
	<div class="editor-grid editor-grid--two grid min-w-0 gap-[22px] grid-cols-[repeat(2,minmax(0,1fr))] max-[500px]:grid-cols-1">
		<Field id="armor" label="Armor" help="Optional armor text shown with the creature's Armor Class.">
			{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id="armor" type="text" value={$monster.stats?.armor ?? ''} oninput={updateArmor} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
		<div class="editor-check-card editor-check-card--inline grid content-center gap-1.5 gap-x-[9px] border border-border bg-[color-mix(in_srgb,var(--muted)_38%,transparent)] p-[13px] grid-cols-[auto_1fr]"><label class="editor-check inline-flex cursor-pointer items-center gap-2 font-display text-[0.76rem] font-bold text-foreground"><input type="checkbox" checked={$monster.stats?.add_dex ?? false} onchange={updateAddDex} /><span>Add Dexterity modifier</span></label></div>
	</div>

	<div class="editor-section__subhead flex items-center gap-[13px] font-display text-[0.65rem] font-extrabold tracking-[0.12em] text-muted-foreground uppercase"><span>Movement / ft.</span><i></i></div>
	<div class="editor-grid editor-grid--five grid min-w-0 gap-[22px] grid-cols-[repeat(5,minmax(0,1fr))] max-[720px]:grid-cols-[repeat(3,minmax(0,1fr))] max-[500px]:grid-cols-[repeat(2,minmax(0,1fr))]">
		{#each speedFields as speed}
			<Field id={`speed-${speed.label.toLowerCase()}`} label={speed.label} help={`The creature's ${speed.label.toLowerCase()} movement in feet.`} error={numericError(speed.field)}>
				{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`speed-${speed.label.toLowerCase()}`} type="text" inputmode="numeric" value={numericDraft(speed.field)} onfocus={() => focusNumeric(speed.field)} oninput={(event) => updateNumericDraft(speed.field, event)} onblur={() => validateNumericBlur(speed.field)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
			</Field>
		{/each}
	</div>

	<div class="editor-section__subhead flex items-center gap-[13px] font-display text-[0.65rem] font-extrabold tracking-[0.12em] text-muted-foreground uppercase"><span>Ability scores</span><i></i></div>
	<div class="editor-grid editor-grid--six grid min-w-0 gap-[22px] grid-cols-[repeat(6,minmax(0,1fr))] max-[720px]:grid-cols-[repeat(3,minmax(0,1fr))] max-[500px]:grid-cols-[repeat(2,minmax(0,1fr))]">
		{#each ABILITY_KEYS as key, index}
			<Field id={`editor-ability-${key}`} label={key.toUpperCase()} help={`${ABILITY_LABELS[key]} score used for modifiers and derived rules.`} error={numericError(`ability.${key}`)}>
				{#snippet children(control)}<input class="editor-control editor-control--score h-11 max-w-full min-h-11 w-full border border-border bg-card py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0 px-[7px] text-center" id={`editor-ability-${key}`} type="text" inputmode="numeric" value={numericDraft(`ability.${key}`)} onfocus={() => focusNumeric(`ability.${key}`)} oninput={(event) => updateNumericDraft(`ability.${key}`, event)} onblur={() => validateNumericBlur(`ability.${key}`)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
			</Field>
		{/each}
	</div>
</section>
