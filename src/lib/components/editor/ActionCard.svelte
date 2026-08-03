<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { CheckmarkCircle04Icon } from '@hugeicons/core-free-icons';
	import Field from './Field.svelte';
	import RepeatableList from './RepeatableList.svelte';
	import TokenPicker from './TokenPicker.svelte';
	import { monster } from '$lib/state/monster-store';
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
		type InnateSpellGroupDraft,
		type SpellcastingDraft,
	} from './action-editor-core';
	import { createRepeatableKeyState, repeatablePrimitiveKey, syncRepeatableKeys, type RepeatableKeyState } from './editor-core';

	type Props = {
		item: ActionItem;
		index: number;
		onChange: (item: ActionItem) => void;
	};

	type NullableNumberKey = 'reach' | 'short_range' | 'long_range';
	type PositiveNumberKey = 'uses' | 'recharge_min' | 'recharge_max' | 'die_count' | 'die_size' | 'level';

	let { item, index, onChange }: Props = $props();
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
	let previousItem: ActionItem | undefined;
	let hasPreviousItem = false;
	let pendingInternalUpdate = false;

	function innateGroupKey(index: number): string {
		return innateGroupKeys.keys[index] ?? repeatablePrimitiveKey(index);
	}

	function innateFrequencyKey(groupKey: string): string {
		return `frequency-${groupKey}`;
	}

	$effect.pre(() => {
		const currentItem = item;
		if (hasPreviousItem && currentItem !== previousItem) {
			if (!pendingInternalUpdate) {
				drafts = {};
				errors = {};
				dirtyFields.clear();
				lastExternalValues.clear();
				focusedField = undefined;
			}
			pendingInternalUpdate = false;
		}
		previousItem = currentItem;
		hasPreviousItem = true;
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
		pendingInternalUpdate = true;
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
			update({ [key]: emptyValue });
			return;
		}
		const value = minimum === 1 ? parsePositiveInteger(raw) : parseNonNegativeInteger(raw);
		if (value === null || value < minimum) {
			errors[key] = minimum === 1 ? 'Use a positive safe whole number.' : 'Use a non-negative safe whole number.';
			return;
		}
		delete errors[key];
		dirtyFields.delete(key);
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
		const next = switchActionPreset(item, preset);
		pendingInternalUpdate = true;
		onChange(next);
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
			updateSpellcasting({ ...spellcasting, levels: spellcasting.levels.map((level, index) => index === levelIndex ? { ...level, slots: 0 } : level) });
			return;
		}
		const slots = parseNonNegativeInteger(raw);
		if (slots === null) {
			errors[key] = 'Use a non-negative safe whole number.';
			return;
		}
		delete errors[key];
		dirtyFields.delete(key);
		updateSpellcasting({ ...spellcasting, levels: spellcasting.levels.map((level, index) => index === levelIndex ? { ...level, slots } : level) });
	}

	function validateLevelSlotsBlur(levelIndex: number): void {
		const key = `slot-${levelIndex}`;
		focusedField = undefined;
		const raw = integerDraft(key, spellcasting.levels[levelIndex]?.slots);
		if (!raw.trim()) {
			delete errors[key];
			dirtyFields.delete(key);
			updateSpellcasting({ ...spellcasting, levels: spellcasting.levels.map((level, index) => index === levelIndex ? { ...level, slots: 0 } : level) });
			return;
		}
		const slots = parseNonNegativeInteger(raw);
		if (slots === null) {
			dirtyFields.add(key);
			errors[key] = 'Use a non-negative safe whole number.';
			return;
		}
		delete errors[key];
		dirtyFields.delete(key);
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
			updateGroup({ ...group, frequency: 0 });
			return;
		}
		const frequency = parseIntegerAtLeast(raw, -1);
		if (frequency === null) {
			errors[key] = 'Use -1 for at will or a non-negative safe whole number.';
			return;
		}
		delete errors[key];
		dirtyFields.delete(key);
		updateGroup({ ...group, frequency });
	}

	function validateInnateFrequencyBlur(groupKey: string, updateGroup: (group: InnateSpellGroupDraft) => void, group: InnateSpellGroupDraft): void {
		const key = innateFrequencyKey(groupKey);
		focusedField = undefined;
		const raw = integerDraft(key, group.frequency);
		if (!raw.trim()) {
			delete errors[key];
			dirtyFields.delete(key);
			updateGroup({ ...group, frequency: 0 });
			return;
		}
		const frequency = parseIntegerAtLeast(raw, -1);
		if (frequency === null) {
			dirtyFields.add(key);
			errors[key] = 'Use -1 for at will or a non-negative safe whole number.';
			return;
		}
		delete errors[key];
		dirtyFields.delete(key);
		updateGroup({ ...group, frequency });
	}

	function createInnateGroup(): InnateSpellGroupDraft {
		return { frequency: -1, spells: [] };
	}
</script>

<article class="action-card" aria-labelledby={`action-name-${index}`}>
	<div class="action-card__heading">
		<div>
			<p class="section-label">Action definition / {String(index + 1).padStart(2, '0')}</p>
			<h3 id={`action-name-${index}`}>{item.name || 'Untitled action'}</h3>
		</div>
		{#if selectedPreset !== 'none'}
			<span class="action-card__preset">{selectedPreset.replaceAll('_', ' ')}</span>
		{/if}
	</div>

	<div class="editor-grid editor-grid--two">
		<Field id={`action-name-field-${index}`} label="Name">
			{#snippet children(control)}
				<input class="editor-control" id={`action-name-field-${index}`} type="text" value={item.name ?? ''} oninput={(event) => updateText('name', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
		<Field id={`action-preset-${index}`} label="Preset" description="Generated prose is previewed below without replacing your source description.">
			{#snippet children(control)}
				<select class="editor-control" id={`action-preset-${index}`} value={selectedPreset} onchange={updatePreset} aria-describedby={control.describedBy} aria-invalid={control.invalid}>
					{#each PRESET_OPTIONS as option}<option value={option.value}>{option.label}</option>{/each}
				</select>
			{/snippet}
		</Field>
	</div>

	<div class="editor-grid editor-grid--three">
		<Field id={`action-uses-${index}`} label="Uses" error={integerError('uses')}>
			{#snippet children(control)}<input class="editor-control" id={`action-uses-${index}`} type="text" inputmode="numeric" value={integerDraft('uses', item.uses)} onfocus={() => focusInteger('uses')} oninput={(event) => updateNumber('uses', event)} onblur={() => validateIntegerBlur('uses', integerDraft('uses', item.uses), 0, undefined)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
		<Field id={`action-interval-${index}`} label="Interval">
			{#snippet children(control)}<input class="editor-control" id={`action-interval-${index}`} type="text" value={item.interval ?? ''} placeholder="day / short rest" oninput={(event) => updateText('interval', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
		<Field id={`action-recharge-min-${index}`} label="Recharge minimum" error={integerError('recharge_min')}>
			{#snippet children(control)}<input class="editor-control" id={`action-recharge-min-${index}`} type="text" inputmode="numeric" value={integerDraft('recharge_min', item.recharge_min)} onfocus={() => focusInteger('recharge_min')} oninput={(event) => updateNumber('recharge_min', event)} onblur={() => validateIntegerBlur('recharge_min', integerDraft('recharge_min', item.recharge_min), 0, undefined)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
		<Field id={`action-recharge-max-${index}`} label="Recharge maximum" error={integerError('recharge_max')}>
			{#snippet children(control)}<input class="editor-control" id={`action-recharge-max-${index}`} type="text" inputmode="numeric" value={integerDraft('recharge_max', item.recharge_max)} onfocus={() => focusInteger('recharge_max')} oninput={(event) => updateNumber('recharge_max', event)} onblur={() => validateIntegerBlur('recharge_max', integerDraft('recharge_max', item.recharge_max), 0, undefined)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
		<Field id={`action-cost-${index}`} label="Cost">
			{#snippet children(control)}<input class="editor-control" id={`action-cost-${index}`} type="text" value={String(item.cost ?? '')} oninput={(event) => updateNumberOrString('cost', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
		<Field id={`action-initiative-${index}`} label="Initiative">
			{#snippet children(control)}<input class="editor-control" id={`action-initiative-${index}`} type="text" value={String(item.initiative ?? '')} oninput={(event) => updateNumberOrString('initiative', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
		</Field>
	</div>

	<Field id={`action-trigger-${index}`} label="Trigger">
		{#snippet children(control)}<input class="editor-control" id={`action-trigger-${index}`} type="text" value={item.trigger ?? ''} oninput={(event) => updateText('trigger', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
	</Field>

	<section class="action-card__advanced-fields" aria-labelledby={`advanced-fields-${index}`}>
		<div class="editor-section__subhead"><span id={`advanced-fields-${index}`}>Save / area details</span><i></i></div>
		<p class="action-card__advanced-description">Optional fields for saving throws, damage, areas, and targets. These values remain available for custom actions and across preset changes.</p>
		<div class="editor-grid editor-grid--three">
			<Field id={`action-dc-ability-${index}`} label="DC ability">
				{#snippet children(control)}
					<select class="editor-control" id={`action-dc-ability-${index}`} value={item.dc_ability ?? ''} onchange={(event) => updateSaveAbility('dc_ability', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid}>
						<option value="">None</option>
						{#each ABILITY_KEYS as ability}<option value={ability}>{ability.toUpperCase()}</option>{/each}
					</select>
				{/snippet}
			</Field>
			<Field id={`action-save-${index}`} label="Save ability">
				{#snippet children(control)}
					<select class="editor-control" id={`action-save-${index}`} value={item.save ?? ''} onchange={(event) => updateSaveAbility('save', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid}>
						<option value="">None</option>
						{#each ABILITY_KEYS as ability}<option value={ability}>{ability.toUpperCase()}</option>{/each}
					</select>
				{/snippet}
			</Field>
			<Field id={`action-dice-${index}`} label="Dice">
				{#snippet children(control)}<input class="editor-control" id={`action-dice-${index}`} type="text" value={item.dice ?? ''} oninput={(event) => updateAdvancedText('dice', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
			</Field>
			<Field id={`action-damage-type-save-${index}`} label="Save damage type">
				{#snippet children(control)}<input class="editor-control" id={`action-damage-type-save-${index}`} type="text" value={item.damage_type_save ?? ''} oninput={(event) => updateAdvancedText('damage_type_save', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
			</Field>
			<Field id={`action-area-${index}`} label="Area">
				{#snippet children(control)}<input class="editor-control" id={`action-area-${index}`} type="text" value={item.area ?? ''} oninput={(event) => updateAdvancedText('area', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
			</Field>
			<Field id={`action-targets-${index}`} label="Targets">
				{#snippet children(control)}<input class="editor-control" id={`action-targets-${index}`} type="text" value={item.targets ?? ''} oninput={(event) => updateAdvancedText('targets', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
			</Field>
		</div>
	</section>

	{#if presetFields === 'attack'}
		<section class="action-card__preset-fields" aria-labelledby={`attack-fields-${index}`}>
			<div class="editor-section__subhead"><span id={`attack-fields-${index}`}>Weapon attack fields</span><i></i></div>
			<div class="editor-grid editor-grid--three">
				<Field id={`attack-ability-${index}`} label="Ability">
					{#snippet children(control)}
						<select class="editor-control" id={`attack-ability-${index}`} value={item.ability ?? ''} onchange={updateAbility} aria-describedby={control.describedBy} aria-invalid={control.invalid}>
							<option value="">Auto / infer</option>
							{#each ABILITY_KEYS as ability}<option value={ability}>{ability.toUpperCase()}</option>{/each}
						</select>
					{/snippet}
				</Field>
		<Field id={`attack-reach-${index}`} label="Reach (ft.)" error={integerError('reach')}>
			{#snippet children(control)}<input class="editor-control" id={`attack-reach-${index}`} type="text" inputmode="numeric" value={integerDraft('reach', item.reach)} onfocus={() => focusInteger('reach')} oninput={(event) => updateNullableNumber('reach', event)} onblur={() => validateIntegerBlur('reach', integerDraft('reach', item.reach), 0, null)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
		<Field id={`attack-short-range-${index}`} label="Short range (ft.)" error={integerError('short_range')}>
			{#snippet children(control)}<input class="editor-control" id={`attack-short-range-${index}`} type="text" inputmode="numeric" value={integerDraft('short_range', item.short_range)} onfocus={() => focusInteger('short_range')} oninput={(event) => updateNullableNumber('short_range', event)} onblur={() => validateIntegerBlur('short_range', integerDraft('short_range', item.short_range), 0, null)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
		<Field id={`attack-long-range-${index}`} label="Long range (ft.)" error={integerError('long_range')}>
			{#snippet children(control)}<input class="editor-control" id={`attack-long-range-${index}`} type="text" inputmode="numeric" value={integerDraft('long_range', item.long_range)} onfocus={() => focusInteger('long_range')} oninput={(event) => updateNullableNumber('long_range', event)} onblur={() => validateIntegerBlur('long_range', integerDraft('long_range', item.long_range), 0, null)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
		<Field id={`attack-die-count-${index}`} label="Die count" error={integerError('die_count')}>
			{#snippet children(control)}<input class="editor-control" id={`attack-die-count-${index}`} type="text" inputmode="numeric" value={integerDraft('die_count', item.die_count)} onfocus={() => focusInteger('die_count')} oninput={(event) => updateNumber('die_count', event)} onblur={() => validateIntegerBlur('die_count', integerDraft('die_count', item.die_count), 1, undefined)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
		<Field id={`attack-die-size-${index}`} label="Die size" error={integerError('die_size')}>
			{#snippet children(control)}<input class="editor-control" id={`attack-die-size-${index}`} type="text" inputmode="numeric" value={integerDraft('die_size', item.die_size)} onfocus={() => focusInteger('die_size')} oninput={(event) => updateNumber('die_size', event)} onblur={() => validateIntegerBlur('die_size', integerDraft('die_size', item.die_size), 1, undefined)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
				<Field id={`attack-damage-type-${index}`} label="Damage type">
					{#snippet children(control)}<input class="editor-control" id={`attack-damage-type-${index}`} type="text" value={item.damage_type ?? ''} oninput={(event) => updateText('damage_type', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
			</div>
		</section>
	{:else if presetFields === 'spellcasting'}
		<section class="action-card__preset-fields" aria-labelledby={`spellcasting-fields-${index}`}>
			<div class="editor-section__subhead"><span id={`spellcasting-fields-${index}`}>Spellcasting fields</span><i></i></div>
			<div class="editor-grid editor-grid--three">
					<Field id={`spellcasting-ability-${index}`} label="Ability">
					{#snippet children(control)}
						<select class="editor-control" id={`spellcasting-ability-${index}`} value={item.ability ?? 'wis'} onchange={updateAbility} aria-describedby={control.describedBy} aria-invalid={control.invalid}>{#each ABILITY_KEYS as ability}<option value={ability}>{ability.toUpperCase()}</option>{/each}</select>
					{/snippet}
				</Field>
					<Field id={`spellcasting-level-${index}`} label="Caster level" error={integerError('level')}>
						{#snippet children(control)}<input class="editor-control" id={`spellcasting-level-${index}`} type="text" inputmode="numeric" value={integerDraft('level', item.level)} onfocus={() => focusInteger('level')} oninput={(event) => updateNumber('level', event)} onblur={() => validateIntegerBlur('level', integerDraft('level', item.level), 1, undefined)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
				<Field id={`spellcasting-class-${index}`} label="Class">
					{#snippet children(control)}<input class="editor-control" id={`spellcasting-class-${index}`} type="text" value={item.class ?? ''} oninput={(event) => updateText('class', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
			</div>
			<RepeatableList label="Cantrips" addLabel="Add cantrip" items={spellcasting.cantrips} createItem={createSpell} getItemName={(spell, spellIndex) => spell || `Cantrip ${spellIndex + 1}`} onItemsChange={updateCantrips}>
				{#snippet children(spell, spellIndex, updateSpell)}
					<Field id={`cantrip-${index}-${spellIndex}`} label={`Cantrip ${spellIndex + 1}`}>
						{#snippet children(control)}<input class="editor-control" id={`cantrip-${index}-${spellIndex}`} type="text" value={spell} oninput={(event) => updateSpell((event.currentTarget as HTMLInputElement).value)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
					</Field>
				{/snippet}
			</RepeatableList>
			<div class="spell-levels">
				{#each spellcasting.levels as level, levelIndex}
					<div class="spell-level">
						<div class="spell-level__heading"><strong>Level {levelIndex + 1}</strong><span>{level.spells.length} prepared</span></div>
						<Field id={`spell-slots-${index}-${levelIndex}`} label="Slots" error={integerError(`slot-${levelIndex}`)}>
							{#snippet children(control)}<input class="editor-control" id={`spell-slots-${index}-${levelIndex}`} type="text" inputmode="numeric" value={integerDraft(`slot-${levelIndex}`, level.slots)} onfocus={() => focusInteger(`slot-${levelIndex}`)} oninput={(event) => updateLevelSlots(levelIndex, event)} onblur={() => validateLevelSlotsBlur(levelIndex)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
						</Field>
						<RepeatableList label={`Level ${levelIndex + 1} prepared spells`} addLabel="Add spell" items={level.spells} createItem={createSpell} getItemName={(spell, spellIndex) => spell || `Spell ${spellIndex + 1}`} onItemsChange={(spells) => updateLevelSpells(levelIndex, spells)}>
							{#snippet children(spell, spellIndex, updateSpell)}
								<Field id={`prepared-spell-${index}-${levelIndex}-${spellIndex}`} label={`Spell ${spellIndex + 1}`}>
									{#snippet children(control)}<input class="editor-control" id={`prepared-spell-${index}-${levelIndex}-${spellIndex}`} type="text" value={spell} oninput={(event) => updateSpell((event.currentTarget as HTMLInputElement).value)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
								</Field>
							{/snippet}
						</RepeatableList>
					</div>
				{/each}
			</div>
		</section>
	{:else if presetFields === 'innate_spellcasting'}
		<section class="action-card__preset-fields" aria-labelledby={`innate-fields-${index}`}>
			<div class="editor-section__subhead"><span id={`innate-fields-${index}`}>Innate spellcasting fields</span><i></i></div>
			<Field id={`innate-ability-${index}`} label="Ability">
				{#snippet children(control)}
					<select class="editor-control" id={`innate-ability-${index}`} value={item.ability ?? 'wis'} onchange={updateAbility} aria-describedby={control.describedBy} aria-invalid={control.invalid}>{#each ABILITY_KEYS as ability}<option value={ability}>{ability.toUpperCase()}</option>{/each}</select>
				{/snippet}
			</Field>
			<RepeatableList label="Innate spell groups" addLabel="Add group" items={innateGroups} createItem={createInnateGroup} getItemName={(group) => innateGroupLabel(group.frequency)} onItemsChange={updateInnateGroups}>
				{#snippet children(group, groupIndex, updateGroup)}
					{@const groupKey = innateGroupKey(groupIndex)}
					<div class="editor-grid editor-grid--two">
						<Field id={`innate-frequency-${index}-${groupIndex}`} label="Frequency" description="Use -1 for at will, or a number for uses per day." error={integerError(innateFrequencyKey(groupKey))}>
							{#snippet children(control)}<input class="editor-control" id={`innate-frequency-${index}-${groupIndex}`} type="text" inputmode="numeric" value={integerDraft(innateFrequencyKey(groupKey), group.frequency)} onfocus={() => focusInteger(innateFrequencyKey(groupKey))} oninput={(event) => updateInnateFrequency(groupKey, event, updateGroup, group)} onblur={() => validateInnateFrequencyBlur(groupKey, updateGroup, group)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
						</Field>
						<div class="editor-note"><strong>{innateGroupLabel(group.frequency)}</strong><span>Spells in this group require no material components.</span></div>
					</div>
					<RepeatableList label={`${innateGroupLabel(group.frequency)} spells`} addLabel="Add spell" items={group.spells} createItem={createSpell} getItemName={(spell, spellIndex) => spell || `Spell ${spellIndex + 1}`} onItemsChange={(spells) => updateGroup({ ...group, spells })}>
						{#snippet children(spell, spellIndex, updateSpell)}
							<Field id={`innate-spell-${index}-${groupIndex}-${spellIndex}`} label={`Spell ${spellIndex + 1}`}>
								{#snippet children(control)}<input class="editor-control" id={`innate-spell-${index}-${groupIndex}-${spellIndex}`} type="text" value={spell} oninput={(event) => updateSpell((event.currentTarget as HTMLInputElement).value)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
							</Field>
						{/snippet}
					</RepeatableList>
				{/snippet}
			</RepeatableList>
		</section>
	{/if}

	<Field id={`action-description-${index}`} label="Description" description={'Markdown and documented {{MON}} tokens are supported. Preset prose is generated from the fields above.'}>
		{#snippet children(control)}
			<div class="action-description">
				<textarea bind:this={descriptionElement} class="editor-control editor-control--area" id={`action-description-${index}`} rows="6" value={item.description ?? ''} oninput={(event) => updateText('description', event)} aria-describedby={control.describedBy} aria-invalid={control.invalid}></textarea>
				<TokenPicker textarea={descriptionElement} onInsert={(description) => update({ description })} />
			</div>
		{/snippet}
	</Field>

	{#if generatedDescription}
		<div class="action-card__generated" aria-live="polite">
			<div class="action-card__generated-heading"><span>Generated preview</span><HugeiconsIcon icon={CheckmarkCircle04Icon} size={14} strokeWidth={1.8} aria-hidden="true" /></div>
			<pre>{generatedDescription}</pre>
		</div>
	{/if}
</article>

<style>
	.action-card { display: grid; gap: 18px; }
	.action-card__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; border-left: 3px solid var(--accent); padding-left: 11px; }
	.action-card__heading h3 { margin: 4px 0 0; font-family: var(--font-display); font-size: 1.2rem; letter-spacing: -0.05em; }
	.action-card__preset { border: 1px solid var(--accent); padding: 5px 7px; color: var(--accent); font-family: var(--font-display); font-size: 0.62rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
	.action-card__preset-fields { display: grid; gap: 16px; border-top: 1px solid var(--border); padding-top: 16px; }
	.action-card__advanced-fields { display: grid; gap: 10px; border-top: 1px solid var(--border); padding-top: 16px; }
	.action-card__advanced-description { margin: -2px 0 2px; color: var(--muted-foreground); font-size: 0.76rem; line-height: 1.4; }
	.action-description { display: grid; gap: 8px; }
	.spell-levels { display: grid; gap: 13px; }
	.spell-level { display: grid; gap: 12px; border: 1px solid var(--border); background: color-mix(in srgb, var(--muted) 22%, transparent); padding: 13px; }
	.spell-level__heading { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
	.spell-level__heading strong { font-family: var(--font-display); font-size: 0.72rem; text-transform: uppercase; }
	.spell-level__heading span { color: var(--muted-foreground); font-size: 0.72rem; }
	.action-card__generated { display: grid; gap: 8px; border-left: 3px solid var(--accent); background: color-mix(in srgb, var(--accent) 7%, var(--card)); padding: 12px 14px; }
	.action-card__generated-heading { display: flex; align-items: center; gap: 7px; color: var(--accent); font-family: var(--font-display); font-size: 0.65rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
	.action-card__generated pre { margin: 0; white-space: pre-wrap; color: var(--foreground); font-family: var(--font-copy); font-size: 0.82rem; line-height: 1.55; }
	@media (max-width: 560px) { .action-card__heading { flex-direction: column; } }
</style>
