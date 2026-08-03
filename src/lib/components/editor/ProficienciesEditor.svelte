<script lang="ts">
	import Field from './Field.svelte';
 import RepeatableList from './RepeatableList.svelte';
  import { monster, replacementEpoch } from '$lib/state/monster-store';
 import type { AbilityKey, Proficiencies, SkillKey } from '$lib/monster/types';
 import { shouldResyncStringDraft, validateSenseDraft } from './editor-core';

	const abilityKeys: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
	const skillKeys: readonly SkillKey[] = [
		'acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine',
		'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival',
	];
	const senses = ['blindsight', 'darkvision', 'tremorsense', 'truesight', 'telepathy'] as const;
	const challengeValues = ['0', '1/8', '1/4', '1/2', ...Array.from({ length: 30 }, (_, index) => String(index + 1))];
 type ListKey = 'damage_resistances' | 'damage_immunities' | 'condition_immunities';
 type KnownKey = 'saves' | 'skills' | 'expertise';
 type SenseKey = (typeof senses)[number];
 let senseDrafts = $state<Partial<Record<SenseKey, string>>>({});
 let senseErrors = $state<Partial<Record<SenseKey, string>>>({});
  const dirtySenses = new Set<SenseKey>();
  const lastExternalSenseValues = new Map<SenseKey, string>();
  let focusedSense: SenseKey | undefined;
  let lastReplacementEpoch: number | undefined;

	function pretty(value: string): string {
		return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
	}

	function toggleKnown(key: KnownKey, value: AbilityKey | SkillKey, checked: boolean): void {
		monster.update((current) => {
			const currentValues = (current.proficiencies?.[key] ?? []) as Array<AbilityKey | SkillKey>;
			const next = checked ? [...new Set([...currentValues, value])] : currentValues.filter((entry) => entry !== value);
			return { ...current, proficiencies: { ...current.proficiencies, [key]: next } };
		});
	}

	function updateList(key: ListKey, items: string[]): void {
		monster.update((current) => ({ ...current, proficiencies: { ...current.proficiencies, [key]: [...items] } }));
	}

  $effect(() => {
    const current = $monster;
    const epoch = $replacementEpoch;
    const replaced = lastReplacementEpoch !== undefined && lastReplacementEpoch !== epoch;
    if (replaced) {
      dirtySenses.clear();
      focusedSense = undefined;
    }
    senses.forEach((sense, index) => {
      const external = String(current.proficiencies?.senses?.[index] ?? 0);
      if (replaced || shouldResyncStringDraft(lastExternalSenseValues.get(sense), external, dirtySenses.has(sense), focusedSense === sense)) {
        senseDrafts[sense] = external;
        delete senseErrors[sense];
      }
      lastExternalSenseValues.set(sense, external);
    });
    lastReplacementEpoch = epoch;
  });

 function senseDraft(sense: SenseKey, index: number): string {
   return senseDrafts[sense] ?? String($monster.proficiencies?.senses?.[index] ?? 0);
 }

 function senseError(sense: SenseKey): string {
   return senseErrors[sense] ?? '';
 }

 function focusSense(sense: SenseKey): void {
   focusedSense = sense;
 }

 function updateSense(sense: SenseKey, index: number, event: Event): void {
   const raw = (event.currentTarget as HTMLInputElement).value;
   senseDrafts[sense] = raw;
   dirtySenses.add(sense);
   const result = validateSenseDraft(raw);
   if (!result.valid) {
     senseErrors[sense] = result.error;
     return;
   }
   delete senseErrors[sense];
   monster.update((current) => {
     const next = [...(current.proficiencies?.senses ?? [0, 0, 0, 0, 0])];
     next[index] = result.value;
     return { ...current, proficiencies: { ...current.proficiencies, senses: next } };
   });
 }

 function validateSenseBlur(sense: SenseKey): void {
   focusedSense = undefined;
   const result = validateSenseDraft(senseDraft(sense, senses.indexOf(sense)));
   if (!result.valid) {
     dirtySenses.add(sense);
     senseErrors[sense] = result.error;
     return;
   }
   dirtySenses.delete(sense);
   delete senseErrors[sense];
 }

	function updateChallenge(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		monster.update((current) => ({ ...current, proficiencies: { ...current.proficiencies, challenge: value === '0' ? 0 : value } }));
	}

	function createString(): string {
		return '';
	}
</script>

<section class="editor-section" aria-labelledby="proficiencies-heading">
	<div class="editor-section__intro">
		<p class="section-label">05 / Rules</p>
		<h2 id="proficiencies-heading">Proficiencies</h2>
		<p>Choose known saves and skills, then record defenses, senses, and challenge.</p>
	</div>

	<div class="editor-check-groups">
		<fieldset class="editor-check-group">
			<legend>Saving throws</legend>
			<div class="editor-check-grid editor-check-grid--six">
				{#each abilityKeys as key}<label class="editor-check"><input type="checkbox" checked={($monster.proficiencies?.saves ?? []).includes(key)} onchange={(event) => toggleKnown('saves', key, (event.currentTarget as HTMLInputElement).checked)} /><span>{key.toUpperCase()}</span></label>{/each}
			</div>
		</fieldset>
		<fieldset class="editor-check-group">
			<legend>Skills</legend>
			<div class="editor-check-grid editor-check-grid--three">
				{#each skillKeys as key}<label class="editor-check"><input type="checkbox" checked={($monster.proficiencies?.skills ?? []).includes(key)} onchange={(event) => toggleKnown('skills', key, (event.currentTarget as HTMLInputElement).checked)} /><span>{pretty(key)}</span></label>{/each}
			</div>
		</fieldset>
		<fieldset class="editor-check-group">
			<legend>Expertise</legend>
			<div class="editor-check-grid editor-check-grid--three">
				{#each skillKeys as key}<label class="editor-check"><input type="checkbox" checked={($monster.proficiencies?.expertise ?? []).includes(key)} onchange={(event) => toggleKnown('expertise', key, (event.currentTarget as HTMLInputElement).checked)} /><span>{pretty(key)}</span></label>{/each}
			</div>
		</fieldset>
	</div>

	<div class="editor-grid editor-grid--two">
		<Field id="challenge" label="Challenge">
			{#snippet children(control)}
				<select class="editor-control" id="challenge" value={String($monster.proficiencies?.challenge ?? 0)} onchange={updateChallenge} aria-describedby={control.describedBy} aria-invalid={control.invalid}>
					{#each challengeValues as value}<option value={value}>{value}</option>{/each}
				</select>
			{/snippet}
		</Field>
		<div class="editor-note"><strong>Schema order</strong><span>Senses use blindsight, darkvision, tremorsense, truesight, telepathy.</span></div>
	</div>

	<div class="editor-grid editor-grid--three">
		{#each senses as sense, index}
			<Field id={`sense-${sense}`} label={pretty(sense)} error={senseError(sense)}>
				{#snippet children(control)}
					<input class="editor-control" id={`sense-${sense}`} type="text" inputmode="numeric" value={senseDraft(sense, index)} onfocus={() => focusSense(sense)} oninput={(event) => updateSense(sense, index, event)} onblur={() => validateSenseBlur(sense)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
				{/snippet}
			</Field>
		{/each}
	</div>

	<div class="editor-repeatables">
		<RepeatableList label="Damage resistances" items={$monster.proficiencies?.damage_resistances ?? []} createItem={createString} onItemsChange={(items) => updateList('damage_resistances', items)}>
			{#snippet children(item, index, update)}
				<Field id={`damage-resistance-${index}`} label={`Resistance ${index + 1}`}>
					{#snippet children(control)}<input class="editor-control" id={`damage-resistance-${index}`} type="text" value={item} oninput={(event) => update((event.currentTarget as HTMLInputElement).value)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
			{/snippet}
		</RepeatableList>
		<RepeatableList label="Damage immunities" items={$monster.proficiencies?.damage_immunities ?? []} createItem={createString} onItemsChange={(items) => updateList('damage_immunities', items)}>
			{#snippet children(item, index, update)}
				<Field id={`damage-immunity-${index}`} label={`Immunity ${index + 1}`}>
					{#snippet children(control)}<input class="editor-control" id={`damage-immunity-${index}`} type="text" value={item} oninput={(event) => update((event.currentTarget as HTMLInputElement).value)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
			{/snippet}
		</RepeatableList>
		<RepeatableList label="Condition immunities" items={$monster.proficiencies?.condition_immunities ?? []} createItem={createString} onItemsChange={(items) => updateList('condition_immunities', items)}>
			{#snippet children(item, index, update)}
				<Field id={`condition-immunity-${index}`} label={`Condition ${index + 1}`}>
					{#snippet children(control)}<input class="editor-control" id={`condition-immunity-${index}`} type="text" value={item} oninput={(event) => update((event.currentTarget as HTMLInputElement).value)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
			{/snippet}
		</RepeatableList>
	</div>
</section>
