<script module lang="ts">
	let nextDraftOwner = 0;
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { CheckmarkCircle04Icon } from '@hugeicons/core-free-icons';
	import Field from './Field.svelte';
	import RepeatableList from './RepeatableList.svelte';
	import TokenPicker from './TokenPicker.svelte';
	import { monster, replacementEpoch } from '$lib/state/monster-store';
	import { presetDescription } from '$lib/monster/presets';
	import type { AbilityKey, ActionItem, PresetName } from '$lib/monster/types';
	import {
		ABILITY_KEYS,
		PRESET_OPTIONS,
		innateGroupLabel,
		normalizeInnateSpellGroups,
		normalizeSpellcastingSpells,
		parseNonNegativeInteger,
		parseIntegerAtLeast,
		parseNumberOrString,
		parsePositiveInteger,
		serializeInnateSpellGroups,
		serializeSpellcastingSpells,
		presetFieldGroup,
		switchActionPreset,
		type ActionArrayKey,
		type InnateSpellGroupDraft,
		type SpellcastingDraft,
	} from './action-editor-core';
	import { createRepeatableKeyState, repeatablePrimitiveKey, syncRepeatableKeys, type RepeatableKeyState } from './editor-core';
	import { clearEditorDraft, clearEditorDrafts, markEditorDraft } from '$lib/state/editor-draft-store';

	type Props = {
		item: ActionItem;
		index: number;
		target: ActionArrayKey;
		onChange: (item: ActionItem) => void;
	};

	type NullableNumberKey = 'reach' | 'short_range' | 'long_range';
	type PositiveNumberKey = 'uses' | 'recharge_min' | 'recharge_max' | 'die_count' | 'die_size' | 'level';

	let { item, index, target, onChange }: Props = $props();
	let idPrefix = $derived(`${target}-action-${index}`);
	const draftOwner = `action-card-${++nextDraftOwner}`;
	let descriptionElement = $state<HTMLTextAreaElement | null>(null);
	let selectedPreset = $derived((item.preset || 'none') as PresetName);
	let presetFields = $derived(presetFieldGroup(selectedPreset));
	let generatedDescription = $derived(presetDescription(item, $monster));
	let spellcasting = $derived(normalizeSpellcastingSpells(item.spells));
	let innateGroups = $derived(normalizeInnateSpellGroups(item.spells));
	function createInitialInnateGroupKeys(): RepeatableKeyState {
		return createRepeatableKeyState(innateGroups.length);
	}

	let innateGroupKeys = $state(createInitialInnateGroupKeys());
	let drafts = $state<Record<string, string>>({});
	let errors = $state<Record<string, string>>({});
	const dirtyFields = new Set<string>();
	const lastExternalValues = new Map<string, string>();
	let focusedField: string | undefined;
	let lastReplacementEpoch: number | undefined;

	onDestroy(() => clearEditorDrafts(draftOwner));

	function innateGroupKey(index: number): string {
		return innateGroupKeys.keys[index] ?? repeatablePrimitiveKey(index);
	}

	function innateFrequencyKey(groupKey: string): string {
		return `frequency-${groupKey}`;
	}

	$effect.pre(() => {
		const epoch = $replacementEpoch;
		const replaced = lastReplacementEpoch !== undefined && lastReplacementEpoch !== epoch;
		if (replaced) {
			drafts = {};
			errors = {};
			dirtyFields.clear();
			clearEditorDrafts(draftOwner);
			lastExternalValues.clear();
			focusedField = undefined;
		}
		lastReplacementEpoch = epoch;
		innateGroups.length;
		syncRepeatableKeys(innateGroupKeys, innateGroups.length);
	});

	$effect(() => {
		const fields = [
			...(['uses', 'recharge_min', 'recharge_max', 'reach', 'short_range', 'long_range', 'die_count', 'die_size', 'level'] as const).map((key) => [key, item[key]] as const),
			...spellcasting.levels.map((level, levelIndex) => [`slot-${levelIndex}`, level.slots] as const),
			...innateGroups.map((group, groupIndex) => [innateFrequencyKey(innateGroupKey(groupIndex)), group.frequency] as const),
		];
		for (const [key, value] of fields) {
			const external = value == null ? '' : String(value);
			const previous = lastExternalValues.get(key);
			if ((previous === undefined || previous !== external) && !dirtyFields.has(key) && focusedField !== key) {
				drafts[key] = external;
				delete errors[key];
			}
			lastExternalValues.set(key, external);
		}
	});

	function update(patch: Partial<ActionItem>): void {
		const next = { ...item, ...patch };
		onChange(next);
	}

	function updateText(key: 'name' | 'interval' | 'trigger' | 'description' | 'damage_type' | 'class', event: Event): void {
		update({ [key]: (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value });
	}

	function updateAdvancedText(key: 'dice' | 'damage_type_save' | 'area' | 'targets', event: Event): void {
		update({ [key]: (event.currentTarget as HTMLInputElement).value });
	}

	function updateNumber(key: PositiveNumberKey, event: Event): void {
		const raw = (event.currentTarget as HTMLInputElement).value;
		updateInteger(key, raw, key === 'die_count' || key === 'die_size' || key === 'level' ? 1 : 0, undefined);
	}

	function updateNullableNumber(key: NullableNumberKey, event: Event): void {
		const raw = (event.currentTarget as HTMLInputElement).value;
		updateInteger(key, raw, 0, null);
	}

	function updateInteger(key: string, raw: string, minimum: number, emptyValue: number | null | undefined): void {
		drafts[key] = raw;
		dirtyFields.add(key);
		if (!raw.trim()) {
			delete errors[key];
			dirtyFields.delete(key);
			clearEditorDraft(draftOwner, key);
			update({ [key]: emptyValue });
			return;
		}
		const value = minimum === 1 ? parsePositiveInteger(raw) : parseNonNegativeInteger(raw);
		if (value === null || value < minimum) {
			markEditorDraft(draftOwner, key);
			errors[key] = minimum === 1 ? 'Use a positive safe whole number.' : 'Use a non-negative safe whole number.';
			return;
		}
		delete errors[key];
		dirtyFields.delete(key);
		clearEditorDraft(draftOwner, key);
		update({ [key]: value });
	}

	function validateIntegerBlur(key: string, raw: string, minimum: number, emptyValue: number | null | undefined): void {
		focusedField = undefined;
		updateInteger(key, raw, minimum, emptyValue);
	}

	function focusInteger(key: string): void {
		focusedField = key;
	}

	function integerDraft(key: string, value: number | string | null | undefined): string {
		return drafts[key] ?? (value == null ? '' : String(value));
	}

	function integerError(key: string): string {
		return errors[key] ?? '';
	}

	function updateNumberOrString(key: 'cost' | 'initiative', event: Event): void {
		update({ [key]: parseNumberOrString((event.currentTarget as HTMLInputElement).value) });
	}

	function updatePreset(event: Event): void {
		const preset = (event.currentTarget as HTMLSelectElement).value as PresetName;
		clearUnmountedPresetDrafts(selectedPreset, preset);
		const next = switchActionPreset(item, preset);
		onChange(next);
	}

	function clearDraft(key: string): void {
		delete drafts[key];
		delete errors[key];
		dirtyFields.delete(key);
		clearEditorDraft(draftOwner, key);
		lastExternalValues.delete(key);
		if (focusedField === key) focusedField = undefined;
	}

	function clearUnmountedPresetDrafts(previousPreset: PresetName, nextPreset: PresetName): void {
		const previousGroup = presetFieldGroup(previousPreset);
		const nextGroup = presetFieldGroup(nextPreset);
		if (previousGroup === nextGroup) return;

		if (previousGroup === 'attack') {
			for (const key of ['reach', 'short_range', 'long_range', 'die_count', 'die_size']) clearDraft(key);
		}
		if (previousGroup === 'spellcasting') {
			clearDraft('level');
			for (let index = 0; index < spellcasting.levels.length; index += 1) clearDraft(`slot-${index}`);
		}
		if (previousGroup === 'innate_spellcasting') {
			for (const groupKey of innateGroupKeys.keys) clearDraft(innateFrequencyKey(groupKey));
		}
	}

	function updateAbility(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		update({ ability: value ? value as AbilityKey : null });
	}

	function updateSaveAbility(key: 'dc_ability' | 'save', event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		update({ [key]: value ? value as AbilityKey : undefined });
	}

	function updateSpellcasting(next: SpellcastingDraft): void {
		update({ spells: serializeSpellcastingSpells(next) });
	}

	function updateCantrips(next: string[]): void {
		updateSpellcasting({ ...spellcasting, cantrips: next });
	}

	function updateLevelSpells(levelIndex: number, next: string[]): void {
		updateSpellcasting({
			...spellcasting,
			levels: spellcasting.levels.map((level, index) => index === levelIndex ? { ...level, spells: next } : level),
		});
	}

	function updateLevelSlots(levelIndex: number, event: Event): void {
		const raw = (event.currentTarget as HTMLInputElement).value;
		const key = `slot-${levelIndex}`;
		drafts[key] = raw;
		dirtyFields.add(key);
		if (!raw.trim()) {
			delete errors[key];
			dirtyFields.delete(key);
			clearEditorDraft(draftOwner, key);
			updateSpellcasting({ ...spellcasting, levels: spellcasting.levels.map((level, index) => index === levelIndex ? { ...level, slots: 0 } : level) });
			return;
		}
		const slots = parseNonNegativeInteger(raw);
		if (slots === null) {
			markEditorDraft(draftOwner, key);
			errors[key] = 'Use a non-negative safe whole number.';
			return;
		}
		delete errors[key];
		dirtyFields.delete(key);
		clearEditorDraft(draftOwner, key);
		updateSpellcasting({ ...spellcasting, levels: spellcasting.levels.map((level, index) => index === levelIndex ? { ...level, slots } : level) });
	}

	function validateLevelSlotsBlur(levelIndex: number): void {
		const key = `slot-${levelIndex}`;
		focusedField = undefined;
		const raw = integerDraft(key, spellcasting.levels[levelIndex]?.slots);
		if (!raw.trim()) {
			delete errors[key];
			dirtyFields.delete(key);
			clearEditorDraft(draftOwner, key);
			updateSpellcasting({ ...spellcasting, levels: spellcasting.levels.map((level, index) => index === levelIndex ? { ...level, slots: 0 } : level) });
			return;
		}
		const slots = parseNonNegativeInteger(raw);
		if (slots === null) {
			dirtyFields.add(key);
			markEditorDraft(draftOwner, key);
			errors[key] = 'Use a non-negative safe whole number.';
			return;
		}
		delete errors[key];
		dirtyFields.delete(key);
		clearEditorDraft(draftOwner, key);
		updateSpellcasting({ ...spellcasting, levels: spellcasting.levels.map((level, index) => index === levelIndex ? { ...level, slots } : level) });
	}

	function createSpell(): string {
		return '';
	}

	function updateInnateGroups(next: InnateSpellGroupDraft[], keys?: readonly string[]): void {
		if (keys) {
			const removedKeys = innateGroupKeys.keys.filter((key) => !keys.includes(key));
			for (const groupKey of removedKeys) {
				const frequencyKey = innateFrequencyKey(groupKey);
				delete drafts[frequencyKey];
				delete errors[frequencyKey];
				dirtyFields.delete(frequencyKey);
				clearEditorDraft(draftOwner, frequencyKey);
				lastExternalValues.delete(frequencyKey);
				if (focusedField === frequencyKey) focusedField = undefined;
			}
			innateGroupKeys.keys = [...keys];
		} else {
			syncRepeatableKeys(innateGroupKeys, next.length);
		}
		update({ spells: serializeInnateSpellGroups(next) });
	}

	function updateInnateFrequency(groupKey: string, event: Event, updateGroup: (group: InnateSpellGroupDraft) => void, group: InnateSpellGroupDraft): void {
		const raw = (event.currentTarget as HTMLInputElement).value;
		const key = innateFrequencyKey(groupKey);
		drafts[key] = raw;
		dirtyFields.add(key);
		if (!raw.trim()) {
			delete errors[key];
			dirtyFields.delete(key);
			clearEditorDraft(draftOwner, key);
			updateGroup({ ...group, frequency: 0 });
			return;
		}
		const frequency = parseIntegerAtLeast(raw, -1);
		if (frequency === null) {
			markEditorDraft(draftOwner, key);
			errors[key] = 'Use -1 for at will or a non-negative safe whole number.';
			return;
		}
		delete errors[key];
		dirtyFields.delete(key);
		clearEditorDraft(draftOwner, key);
		updateGroup({ ...group, frequency });
	}

	function validateInnateFrequencyBlur(groupKey: string, updateGroup: (group: InnateSpellGroupDraft) => void, group: InnateSpellGroupDraft): void {
		const key = innateFrequencyKey(groupKey);
		focusedField = undefined;
		const raw = integerDraft(key, group.frequency);
		if (!raw.trim()) {
			delete errors[key];
			dirtyFields.delete(key);
			clearEditorDraft(draftOwner, key);
			updateGroup({ ...group, frequency: 0 });
			return;
		}
		const frequency = parseIntegerAtLeast(raw, -1);
		if (frequency === null) {
			dirtyFields.add(key);
			markEditorDraft(draftOwner, key);
			errors[key] = 'Use -1 for at will or a non-negative safe whole number.';
			return;
		}
		delete errors[key];
		dirtyFields.delete(key);
		clearEditorDraft(draftOwner, key);
		updateGroup({ ...group, frequency });
	}

	function createInnateGroup(): InnateSpellGroupDraft {
		return { frequency: -1, spells: [] };
	}
</script>

	<article class="action-card grid gap-[18px]" aria-labelledby={`${idPrefix}-name`}>
	<div class="action-card__heading flex items-start justify-between gap-[14px] border-l-[3px] border-l-accent pl-[11px] max-[560px]:flex-col">
		<div>
			<h3 id={`${idPrefix}-name`} class="m-0 mt-1 min-w-0 font-display text-[clamp(1.25rem,2.1vw,1.5rem)] tracking-[-0.05em] [overflow-wrap:anywhere] [word-break:break-word]">{item.name || 'Untitled action'}</h3>
		</div>
		{#if selectedPreset !== 'none'}
			<span class="action-card__preset border border-accent px-[7px] py-[5px] font-display text-[0.62rem] font-extrabold tracking-[0.08em] text-accent uppercase">{selectedPreset.replaceAll('_', ' ')}</span>
		{/if}
	</div>

	<div class="editor-grid editor-grid--two grid min-w-0 gap-[22px] grid-cols-[repeat(2,minmax(0,1fr))] max-[500px]:grid-cols-1">
		<Field id={`${idPrefix}-name-field`} label="Name" help="The action name shown in the stat block.">
			{#snippet children(control)}
				<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-name-field`} type="text" value={item.name ?? ''} oninput={(event) => updateText('name', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
		<Field id={`${idPrefix}-preset`} label="Preset" help="Choose a structured preset; generated prose is previewed below without replacing your source description.">
			{#snippet children(control)}
				<select class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-preset`} value={selectedPreset} onchange={updatePreset} aria-describedby={control.describedBy} aria-invalid={control.invalid}>
					{#each PRESET_OPTIONS as option}<option value={option.value}>{option.label}</option>{/each}
				</select>
			{/snippet}
		</Field>
	</div>

	<div class="editor-grid editor-grid--three grid min-w-0 gap-[22px] grid-cols-[repeat(3,minmax(0,1fr))] max-[500px]:grid-cols-1">
		<Field id={`${idPrefix}-uses`} label="Uses" help="The number of times this action can be used before its interval resets." error={integerError('uses')}>
			{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-uses`} type="text" inputmode="numeric" value={integerDraft('uses', item.uses)} onfocus={() => focusInteger('uses')} oninput={(event) => updateNumber('uses', event)} onblur={() => validateIntegerBlur('uses', integerDraft('uses', item.uses), 0, undefined)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
		<Field id={`${idPrefix}-interval`} label="Interval" help="When uses reset, such as day or short rest.">
			{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-interval`} type="text" value={item.interval ?? ''} placeholder="day / short rest" oninput={(event) => updateText('interval', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
		<Field id={`${idPrefix}-recharge-min`} label="Recharge minimum" help="The lowest result that recharges this action." error={integerError('recharge_min')}>
			{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-recharge-min`} type="text" inputmode="numeric" value={integerDraft('recharge_min', item.recharge_min)} onfocus={() => focusInteger('recharge_min')} oninput={(event) => updateNumber('recharge_min', event)} onblur={() => validateIntegerBlur('recharge_min', integerDraft('recharge_min', item.recharge_min), 0, undefined)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
		<Field id={`${idPrefix}-recharge-max`} label="Recharge maximum" help="The highest result that recharges this action." error={integerError('recharge_max')}>
			{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-recharge-max`} type="text" inputmode="numeric" value={integerDraft('recharge_max', item.recharge_max)} onfocus={() => focusInteger('recharge_max')} oninput={(event) => updateNumber('recharge_max', event)} onblur={() => validateIntegerBlur('recharge_max', integerDraft('recharge_max', item.recharge_max), 0, undefined)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
		<Field id={`${idPrefix}-cost`} label="Cost" help="An optional resource cost for this action.">
			{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-cost`} type="text" value={String(item.cost ?? '')} oninput={(event) => updateNumberOrString('cost', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
		<Field id={`${idPrefix}-initiative`} label="Initiative" help="An optional initiative value for ordering this action.">
			{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-initiative`} type="text" value={String(item.initiative ?? '')} oninput={(event) => updateNumberOrString('initiative', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
	</div>

	<Field id={`${idPrefix}-trigger`} label="Trigger" help="The event or condition that makes this action available.">
		{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-trigger`} type="text" value={item.trigger ?? ''} oninput={(event) => updateText('trigger', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
	</Field>

	<section class="action-card__advanced-fields grid gap-2.5 border-t border-border pt-4" aria-labelledby={`${idPrefix}-advanced-fields`}>
		<div class="editor-section__subhead flex items-center gap-[13px] font-display text-[0.65rem] font-extrabold tracking-[0.12em] text-muted-foreground uppercase"><span id={`${idPrefix}-advanced-fields`}>Save / area details</span><i></i></div>
		<p class="action-card__advanced-description mx-0 my-[-2px] mb-[2px] text-[0.76rem] leading-[1.4] text-muted-foreground">Optional fields for saving throws, damage, areas, and targets. These values remain available for custom actions and across preset changes.</p>
		<div class="editor-grid editor-grid--three grid min-w-0 gap-[22px] grid-cols-[repeat(3,minmax(0,1fr))] max-[500px]:grid-cols-1">
			<Field id={`${idPrefix}-dc-ability`} label="DC ability" help="The ability used to calculate this saving throw's DC.">
				{#snippet children(control)}
					<select class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-dc-ability`} value={item.dc_ability ?? ''} onchange={(event) => updateSaveAbility('dc_ability', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid}>
						<option value="">None</option>
						{#each ABILITY_KEYS as ability}<option value={ability}>{ability.toUpperCase()}</option>{/each}
					</select>
				{/snippet}
			</Field>
			<Field id={`${idPrefix}-save`} label="Save ability" help="The ability the target rolls against this action.">
				{#snippet children(control)}
					<select class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-save`} value={item.save ?? ''} onchange={(event) => updateSaveAbility('save', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid}>
						<option value="">None</option>
						{#each ABILITY_KEYS as ability}<option value={ability}>{ability.toUpperCase()}</option>{/each}
					</select>
				{/snippet}
			</Field>
			<Field id={`${idPrefix}-dice`} label="Dice" help="Optional dice notation for saving throw or area damage.">
				{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-dice`} type="text" value={item.dice ?? ''} oninput={(event) => updateAdvancedText('dice', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
			</Field>
			<Field id={`${idPrefix}-damage-type-save`} label="Save damage type" help="The damage type applied by this saving throw.">
				{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-damage-type-save`} type="text" value={item.damage_type_save ?? ''} oninput={(event) => updateAdvancedText('damage_type_save', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
			</Field>
			<Field id={`${idPrefix}-area`} label="Area" help="The shape or size of the affected area.">
				{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-area`} type="text" value={item.area ?? ''} oninput={(event) => updateAdvancedText('area', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
			</Field>
			<Field id={`${idPrefix}-targets`} label="Targets" help="The creatures or objects this action can target.">
				{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-targets`} type="text" value={item.targets ?? ''} oninput={(event) => updateAdvancedText('targets', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
			</Field>
		</div>
	</section>

	{#if presetFields === 'attack'}
		<section class="action-card__preset-fields grid gap-4 border-t border-border pt-4" aria-labelledby={`${idPrefix}-attack-fields`}>
			<div class="editor-section__subhead flex items-center gap-[13px] font-display text-[0.65rem] font-extrabold tracking-[0.12em] text-muted-foreground uppercase"><span id={`${idPrefix}-attack-fields`}>Weapon attack fields</span><i></i></div>
			<div class="editor-grid editor-grid--three grid min-w-0 gap-[22px] grid-cols-[repeat(3,minmax(0,1fr))] max-[500px]:grid-cols-1">
				<Field id={`${idPrefix}-attack-ability`} label="Ability" help="The ability used for this attack's bonus and damage.">
					{#snippet children(control)}
						<select class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-attack-ability`} value={item.ability ?? ''} onchange={updateAbility} aria-describedby={control.describedBy} aria-invalid={control.invalid}>
							<option value="">Auto / infer</option>
							{#each ABILITY_KEYS as ability}<option value={ability}>{ability.toUpperCase()}</option>{/each}
						</select>
					{/snippet}
				</Field>
		<Field id={`${idPrefix}-attack-reach`} label="Reach (ft.)" help="The distance of a melee attack in feet." error={integerError('reach')}>
			{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-attack-reach`} type="text" inputmode="numeric" value={integerDraft('reach', item.reach)} onfocus={() => focusInteger('reach')} oninput={(event) => updateNullableNumber('reach', event)} onblur={() => validateIntegerBlur('reach', integerDraft('reach', item.reach), 0, null)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
		<Field id={`${idPrefix}-attack-short-range`} label="Short range (ft.)" help="The normal range of a ranged attack in feet." error={integerError('short_range')}>
			{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-attack-short-range`} type="text" inputmode="numeric" value={integerDraft('short_range', item.short_range)} onfocus={() => focusInteger('short_range')} oninput={(event) => updateNullableNumber('short_range', event)} onblur={() => validateIntegerBlur('short_range', integerDraft('short_range', item.short_range), 0, null)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
		<Field id={`${idPrefix}-attack-long-range`} label="Long range (ft.)" help="The maximum range of a ranged attack in feet." error={integerError('long_range')}>
			{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-attack-long-range`} type="text" inputmode="numeric" value={integerDraft('long_range', item.long_range)} onfocus={() => focusInteger('long_range')} oninput={(event) => updateNullableNumber('long_range', event)} onblur={() => validateIntegerBlur('long_range', integerDraft('long_range', item.long_range), 0, null)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
		<Field id={`${idPrefix}-attack-die-count`} label="Die count" help="The number of damage dice rolled by this attack." error={integerError('die_count')}>
			{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-attack-die-count`} type="text" inputmode="numeric" value={integerDraft('die_count', item.die_count)} onfocus={() => focusInteger('die_count')} oninput={(event) => updateNumber('die_count', event)} onblur={() => validateIntegerBlur('die_count', integerDraft('die_count', item.die_count), 1, undefined)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
		<Field id={`${idPrefix}-attack-die-size`} label="Die size" help="The size of each damage die, such as 6 for d6." error={integerError('die_size')}>
			{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-attack-die-size`} type="text" inputmode="numeric" value={integerDraft('die_size', item.die_size)} onfocus={() => focusInteger('die_size')} oninput={(event) => updateNumber('die_size', event)} onblur={() => validateIntegerBlur('die_size', integerDraft('die_size', item.die_size), 1, undefined)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
				<Field id={`${idPrefix}-attack-damage-type`} label="Damage type" help="The damage type dealt by this attack.">
					{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-attack-damage-type`} type="text" value={item.damage_type ?? ''} oninput={(event) => updateText('damage_type', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
			</div>
		</section>
	{:else if presetFields === 'spellcasting'}
		<section class="action-card__preset-fields grid gap-4 border-t border-border pt-4" aria-labelledby={`${idPrefix}-spellcasting-fields`}>
			<div class="editor-section__subhead flex items-center gap-[13px] font-display text-[0.65rem] font-extrabold tracking-[0.12em] text-muted-foreground uppercase"><span id={`${idPrefix}-spellcasting-fields`}>Spellcasting fields</span><i></i></div>
			<div class="editor-grid editor-grid--three grid min-w-0 gap-[22px] grid-cols-[repeat(3,minmax(0,1fr))] max-[500px]:grid-cols-1">
					<Field id={`${idPrefix}-spellcasting-ability`} label="Ability" help="The ability used for this spellcasting feature.">
					{#snippet children(control)}
						<select class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-spellcasting-ability`} value={item.ability ?? 'wis'} onchange={updateAbility} aria-describedby={control.describedBy} aria-invalid={control.invalid}>{#each ABILITY_KEYS as ability}<option value={ability}>{ability.toUpperCase()}</option>{/each}</select>
					{/snippet}
				</Field>
					<Field id={`${idPrefix}-spellcasting-level`} label="Caster level" help="The caster level used for spell effects and scaling." error={integerError('level')}>
						{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-spellcasting-level`} type="text" inputmode="numeric" value={integerDraft('level', item.level)} onfocus={() => focusInteger('level')} oninput={(event) => updateNumber('level', event)} onblur={() => validateIntegerBlur('level', integerDraft('level', item.level), 1, undefined)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
				<Field id={`${idPrefix}-spellcasting-class`} label="Class" help="The spellcasting class associated with this feature.">
					{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-spellcasting-class`} type="text" value={item.class ?? ''} oninput={(event) => updateText('class', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
			</div>
			<RepeatableList label="Cantrips" addLabel="Add cantrip" items={spellcasting.cantrips} createItem={createSpell} getItemName={(spell, spellIndex) => spell || `Cantrip ${spellIndex + 1}`} onItemsChange={updateCantrips}>
				{#snippet children(spell, spellIndex, updateSpell)}
					<Field id={`${idPrefix}-cantrip-${spellIndex}`} label={`Cantrip ${spellIndex + 1}`} help="A cantrip available to this spellcaster.">
						{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-cantrip-${spellIndex}`} type="text" value={spell} oninput={(event) => updateSpell((event.currentTarget as HTMLInputElement).value)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
					</Field>
				{/snippet}
			</RepeatableList>
			<div class="spell-levels grid gap-[13px]">
				{#each spellcasting.levels as level, levelIndex}
					<div class="spell-level grid min-w-0 gap-3 border border-border border-l-[3px] border-l-accent bg-[color-mix(in_srgb,var(--muted)_22%,transparent)] p-[13px] pl-[14px]">
						<div class="spell-level__heading flex items-baseline justify-between gap-2.5 border-b border-border pb-2"><strong class="font-display text-[0.72rem] uppercase">Level {levelIndex + 1}</strong><span class="text-[0.72rem] text-muted-foreground">{level.spells.length} prepared</span></div>
						<Field id={`${idPrefix}-spell-slots-${levelIndex}`} label="Slots" help={`The number of level ${levelIndex + 1} spell slots available.`} error={integerError(`slot-${levelIndex}`)}>
							{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-spell-slots-${levelIndex}`} type="text" inputmode="numeric" value={integerDraft(`slot-${levelIndex}`, level.slots)} onfocus={() => focusInteger(`slot-${levelIndex}`)} oninput={(event) => updateLevelSlots(levelIndex, event)} onblur={() => validateLevelSlotsBlur(levelIndex)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
						</Field>
						<RepeatableList label={`Level ${levelIndex + 1} prepared spells`} addLabel="Add spell" items={level.spells} createItem={createSpell} getItemName={(spell, spellIndex) => spell || `Spell ${spellIndex + 1}`} onItemsChange={(spells) => updateLevelSpells(levelIndex, spells)}>
							{#snippet children(spell, spellIndex, updateSpell)}
									<Field id={`${idPrefix}-prepared-spell-${levelIndex}-${spellIndex}`} label={`Spell ${spellIndex + 1}`} help="A prepared spell available at this level.">
										{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-prepared-spell-${levelIndex}-${spellIndex}`} type="text" value={spell} oninput={(event) => updateSpell((event.currentTarget as HTMLInputElement).value)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
								</Field>
							{/snippet}
						</RepeatableList>
					</div>
				{/each}
			</div>
		</section>
	{:else if presetFields === 'innate_spellcasting'}
		<section class="action-card__preset-fields grid gap-4 border-t border-border pt-4" aria-labelledby={`${idPrefix}-innate-fields`}>
			<div class="editor-section__subhead flex items-center gap-[13px] font-display text-[0.65rem] font-extrabold tracking-[0.12em] text-muted-foreground uppercase"><span id={`${idPrefix}-innate-fields`}>Innate spellcasting fields</span><i></i></div>
			<Field id={`${idPrefix}-innate-ability`} label="Ability" help="The ability used for this innate spellcasting feature.">
				{#snippet children(control)}
					<select class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-innate-ability`} value={item.ability ?? 'wis'} onchange={updateAbility} aria-describedby={control.describedBy} aria-invalid={control.invalid}>{#each ABILITY_KEYS as ability}<option value={ability}>{ability.toUpperCase()}</option>{/each}</select>
				{/snippet}
			</Field>
			<RepeatableList label="Innate spell groups" addLabel="Add group" items={innateGroups} createItem={createInnateGroup} getItemName={(group) => innateGroupLabel(group.frequency)} onItemsChange={updateInnateGroups}>
				{#snippet children(group, groupIndex, updateGroup)}
					{@const groupKey = innateGroupKey(groupIndex)}
					<div class="editor-grid editor-grid--two grid min-w-0 gap-[22px] grid-cols-[repeat(2,minmax(0,1fr))] max-[500px]:grid-cols-1">
						<Field id={`${idPrefix}-innate-frequency-${groupIndex}`} label="Frequency" help="Use -1 for at will, or a number for uses per day." error={integerError(innateFrequencyKey(groupKey))}>
							{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-innate-frequency-${groupIndex}`} type="text" inputmode="numeric" value={integerDraft(innateFrequencyKey(groupKey), group.frequency)} onfocus={() => focusInteger(innateFrequencyKey(groupKey))} oninput={(event) => updateInnateFrequency(groupKey, event, updateGroup, group)} onblur={() => validateInnateFrequencyBlur(groupKey, updateGroup, group)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
						</Field>
						<div class="editor-note grid content-center gap-[5px] border-l-[3px] border-l-accent px-3 py-[5px]"><strong>{innateGroupLabel(group.frequency)}</strong><span>Spells in this group require no material components.</span></div>
					</div>
					<RepeatableList label={`${innateGroupLabel(group.frequency)} spells`} addLabel="Add spell" items={group.spells} createItem={createSpell} getItemName={(spell, spellIndex) => spell || `Spell ${spellIndex + 1}`} onItemsChange={(spells) => updateGroup({ ...group, spells })}>
						{#snippet children(spell, spellIndex, updateSpell)}
							<Field id={`${idPrefix}-innate-spell-${groupIndex}-${spellIndex}`} label={`Spell ${spellIndex + 1}`} help="A spell available in this innate spell group.">
								{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`${idPrefix}-innate-spell-${groupIndex}-${spellIndex}`} type="text" value={spell} oninput={(event) => updateSpell((event.currentTarget as HTMLInputElement).value)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
							</Field>
						{/snippet}
					</RepeatableList>
				{/snippet}
			</RepeatableList>
		</section>
	{/if}

	<Field id={`${idPrefix}-description`} label="Description" help={'Markdown and documented {{MON}} tokens are supported. Preset prose is generated from the fields above.'}>
		{#snippet children(control)}
			<div class="action-description grid gap-2">
			<textarea bind:this={descriptionElement} class="editor-control editor-control--area max-w-full w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0 h-[116px] min-h-[116px] resize-y" id={`${idPrefix}-description`} rows="6" value={item.description ?? ''} oninput={(event) => updateText('description', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid}></textarea>
				<TokenPicker idPrefix={idPrefix} textarea={descriptionElement} onInsert={(description) => update({ description })} />
			</div>
		{/snippet}
	</Field>

	{#if generatedDescription}
		<div class="action-card__generated grid gap-2 border-l-[3px] border-l-accent bg-[color-mix(in_srgb,var(--accent)_7%,var(--card))] px-[14px] py-3" aria-live="polite">
			<div class="action-card__generated-heading flex items-center gap-[7px] font-display text-[0.65rem] font-extrabold tracking-[0.1em] text-accent uppercase"><span>Generated preview</span><HugeiconsIcon icon={CheckmarkCircle04Icon} size={14} strokeWidth={1.8} aria-hidden="true" /></div>
			<pre class="m-0 font-copy text-[0.82rem] leading-[1.55] text-foreground [white-space:pre-wrap]">{generatedDescription}</pre>
		</div>
	{/if}
</article>
