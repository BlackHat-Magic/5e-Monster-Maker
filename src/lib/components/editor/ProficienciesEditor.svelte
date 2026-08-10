<script lang="ts">
	import { onDestroy } from 'svelte';
	import Field from './Field.svelte';
	import FieldHelp from './FieldHelp.svelte';
  import CanonicalSelector from './CanonicalSelector.svelte';
  import { monster, replacementEpoch } from '$lib/state/monster-store';
  import type { AbilityKey, SkillKey } from '$lib/monster/types';
  import { addImmunity, excludeDefenseValues, sortDefenseValues } from '$lib/monster/defenses';
  import { shouldResyncStringDraft, validateSenseDraft } from './editor-core';
  import { clearEditorDraft, clearEditorDrafts, markEditorDraft } from '$lib/state/editor-draft-store';

  const draftOwner = 'proficiencies-editor';

	const abilityKeys: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
	const skillKeys: readonly SkillKey[] = [
		'acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine',
		'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival',
	];
	const senses = ['blindsight', 'darkvision', 'tremorsense', 'truesight', 'telepathy'] as const;
	const challengeValues = ['0', '1/8', '1/4', '1/2', ...Array.from({ length: 30 }, (_, index) => String(index + 1))];
  type KnownKey = 'saves' | 'skills' | 'expertise';
 type SenseKey = (typeof senses)[number];
 let senseDrafts = $state<Partial<Record<SenseKey, string>>>({});
 let senseErrors = $state<Partial<Record<SenseKey, string>>>({});
  const dirtySenses = new Set<SenseKey>();
  const lastExternalSenseValues = new Map<SenseKey, string>();
  let focusedSense: SenseKey | undefined;
   let lastReplacementEpoch: number | undefined;

   onDestroy(() => clearEditorDrafts(draftOwner));

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

 function updateResistances(values: string[]): void {
    monster.update((current) => {
      const proficiencies = current.proficiencies ?? {};
      return {
        ...current,
        proficiencies: {
          ...proficiencies,
          damage_resistances: excludeDefenseValues('damage', values, proficiencies.damage_immunities ?? []),
        },
      };
    });
 }

  function updateVulnerabilities(values: string[]): void {
    monster.update((current) => {
      const proficiencies = current.proficiencies ?? {};
      return {
        ...current,
        proficiencies: {
          ...proficiencies,
          damage_vulnerabilities: excludeDefenseValues('damage', values, proficiencies.damage_immunities ?? []),
        },
      };
    });
  }

	function updateImmunities(values: string[], addedValue?: string): void {
		monster.update((current) => {
			const proficiencies = current.proficiencies ?? {};
			if (addedValue) return { ...current, proficiencies: addImmunity(proficiencies, addedValue) };
			return {
				...current,
				proficiencies: { ...proficiencies, damage_immunities: sortDefenseValues('damage', values) },
			};
		});
	}

	function updateConditionImmunities(values: string[]): void {
		monster.update((current) => ({
			...current,
			proficiencies: { ...current.proficiencies, condition_immunities: sortDefenseValues('condition', values) },
		}));
	}

  $effect(() => {
    const current = $monster;
    const epoch = $replacementEpoch;
    const replaced = lastReplacementEpoch !== undefined && lastReplacementEpoch !== epoch;
    if (replaced) {
     dirtySenses.clear();
      focusedSense = undefined;
      clearEditorDrafts(draftOwner);
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
      markEditorDraft(draftOwner, sense);
      senseErrors[sense] = result.error;
      return;
    }
    clearEditorDraft(draftOwner, sense);
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
      markEditorDraft(draftOwner, sense);
      senseErrors[sense] = result.error;
      return;
    }
    clearEditorDraft(draftOwner, sense);
   dirtySenses.delete(sense);
   delete senseErrors[sense];
 }

	function updateChallenge(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		monster.update((current) => ({ ...current, proficiencies: { ...current.proficiencies, challenge: value === '0' ? 0 : value } }));
	}

</script>

	<section class="editor-section" aria-labelledby="proficiencies-heading">
	<div class="editor-section__intro">
		<h2 id="proficiencies-heading">Proficiencies</h2>
		<p>Choose known saves and skills, then record defenses, senses, and challenge.</p>
	</div>

	<div class="editor-check-groups">
		<fieldset class="editor-check-group">
			<legend>Saving throws <FieldHelp label="Saving throws" help="Choose the ability saving throws in which this creature is proficient." /></legend>
			<div class="editor-check-grid editor-check-grid--six">
				{#each abilityKeys as key}<label class="editor-check"><input type="checkbox" checked={($monster.proficiencies?.saves ?? []).includes(key)} onchange={(event) => toggleKnown('saves', key, (event.currentTarget as HTMLInputElement).checked)} /><span>{key.toUpperCase()}</span></label>{/each}
			</div>
		</fieldset>
		<fieldset class="editor-check-group">
			<legend>Skills <FieldHelp label="Skills" help="Choose the skills in which this creature is proficient." /></legend>
			<div class="editor-check-grid editor-check-grid--three">
				{#each skillKeys as key}<label class="editor-check"><input type="checkbox" checked={($monster.proficiencies?.skills ?? []).includes(key)} onchange={(event) => toggleKnown('skills', key, (event.currentTarget as HTMLInputElement).checked)} /><span>{pretty(key)}</span></label>{/each}
			</div>
		</fieldset>
		<fieldset class="editor-check-group">
			<legend>Expertise <FieldHelp label="Expertise" help="Choose skills that receive expertise-level proficiency." /></legend>
			<div class="editor-check-grid editor-check-grid--three">
				{#each skillKeys as key}<label class="editor-check"><input type="checkbox" checked={($monster.proficiencies?.expertise ?? []).includes(key)} onchange={(event) => toggleKnown('expertise', key, (event.currentTarget as HTMLInputElement).checked)} /><span>{pretty(key)}</span></label>{/each}
			</div>
		</fieldset>
	</div>

	<div class="editor-grid">
		<Field id="challenge" label="Challenge" help="The challenge rating used in the generated stat block.">
			{#snippet children(control)}
				<select class="editor-control" id="challenge" value={String($monster.proficiencies?.challenge ?? 0)} onchange={updateChallenge} aria-describedby={control.describedBy} aria-invalid={control.invalid}>
					{#each challengeValues as value}<option value={value}>{value}</option>{/each}
				</select>
			{/snippet}
		</Field>
	</div>

	<div class="editor-grid editor-grid--three">
		{#each senses as sense, index}
				<Field id={`sense-${sense}`} label={pretty(sense)} help={`The ${pretty(sense).toLowerCase()} range in feet.`} error={senseError(sense)}>
				{#snippet children(control)}
					<input class="editor-control" id={`sense-${sense}`} type="text" inputmode="numeric" value={senseDraft(sense, index)} onfocus={() => focusSense(sense)} oninput={(event) => updateSense(sense, index, event)} onblur={() => validateSenseBlur(sense)} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
				{/snippet}
			</Field>
		{/each}
	</div>

	<div class="editor-grid editor-grid--three">
		<CanonicalSelector label="Damage vulnerabilities" kind="damage" values={$monster.proficiencies?.damage_vulnerabilities ?? []} help="Damage types or sources that deal extra damage to the creature." onChange={updateVulnerabilities} />
		<CanonicalSelector label="Damage resistances" kind="damage" values={$monster.proficiencies?.damage_resistances ?? []} help="Damage types or sources the creature resists." onChange={updateResistances} />
		<CanonicalSelector label="Damage immunities" kind="damage" values={$monster.proficiencies?.damage_immunities ?? []} help="Damage types or sources the creature ignores." onChange={updateImmunities} />
		<CanonicalSelector label="Condition immunities" kind="condition" values={$monster.proficiencies?.condition_immunities ?? []} help="Conditions that cannot affect the creature." onChange={updateConditionImmunities} />
	</div>
</section>
