<script lang="ts">
  import { tick } from 'svelte';
  import FieldHelp from './FieldHelp.svelte';
  import { addDefenseValue, defenseLabel, removeDefenseValue, sortDefenseValues, DAMAGE_CANONICAL_VALUES, CONDITION_CANONICAL_VALUES, type DefenseKind } from '$lib/monster/defenses';

  type Props = {
    label: string;
    kind: DefenseKind;
    values: readonly string[];
    help?: string;
    onChange: (values: string[], addedValue?: string) => void;
  };

  const otherValue = '__other__';
  let { label, kind, values, help = '', onChange }: Props = $props();
  let selectedValue = $state('');
  let customValue = $state('');
  let customError = $state('');
  let customInputElement = $state<HTMLInputElement | null>(null);
  let customMode = $derived(selectedValue === otherValue);
  let controlId = $derived(`canonical-${kind}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
  let orderedValues = $derived(sortDefenseValues(kind, values));
  let canonicalValues = $derived(kind === 'damage' ? DAMAGE_CANONICAL_VALUES : CONDITION_CANONICAL_VALUES);

  async function selectValue(event: Event): Promise<void> {
    const next = (event.currentTarget as HTMLSelectElement).value;
    selectedValue = next;
    customError = '';
    if (next === otherValue) {
      await tick();
      customInputElement?.focus();
      return;
    }
    if (!next) return;

    onChange(addDefenseValue(kind, values, next), next);
    selectedValue = '';
  }

  async function addCustomValue(): Promise<void> {
    const trimmed = customValue.trim();
    if (!trimmed) {
      customError = 'Enter a value before adding.';
      await tick();
      customInputElement?.focus();
      return;
    }
    if (values.some((value) => value.trim().toLowerCase() === trimmed.toLowerCase())) {
      customError = 'That value is already selected.';
      await tick();
      customInputElement?.focus();
      return;
    }

    onChange(addDefenseValue(kind, values, trimmed), trimmed);
    customValue = '';
    customError = '';
    await tick();
    customInputElement?.focus();
  }

  function handleCustomKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addCustomValue();
  }

  function removeValue(value: string): void {
    onChange(removeDefenseValue(kind, values, value));
  }
</script>

<section class="canonical-selector grid min-w-0 gap-3" aria-labelledby={`${controlId}-label`}>
  <div class="canonical-selector__heading flex items-center justify-between gap-3">
    <div class="canonical-selector__label inline-flex items-center gap-[7px]">
      <label class="font-display text-[0.7rem] font-[750] tracking-[0.04em] text-foreground uppercase" id={`${controlId}-label`} for={controlId}>{label}</label>
      {#if help}<FieldHelp label={label} help={help} />{/if}
    </div>
    <span class="canonical-selector__count font-display text-[0.7rem] tracking-[0.08em] text-accent">{orderedValues.length.toString().padStart(2, '0')}</span>
  </div>

  <select class="editor-control canonical-selector__select h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={controlId} value={selectedValue} onchange={selectValue} aria-label={`Add ${label.toLowerCase()}`}>
    <option value="">Add a value...</option>
    {#each canonicalValues as value}
      <option value={value}>{defenseLabel(kind, value)}</option>
    {/each}
    <option value={otherValue}>Other</option>
  </select>

  {#if customMode}
    <div class="canonical-selector__custom grid grid-cols-[minmax(0,1fr)_auto] gap-2 max-[500px]:grid-cols-1">
      <input bind:this={customInputElement} class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" type="text" value={customValue} placeholder="Describe a custom defense" aria-label={`Custom ${label.toLowerCase()}`} aria-describedby={customError ? `${controlId}-custom-error` : undefined} aria-invalid={customError ? 'true' : undefined} oninput={(event) => (customValue = (event.currentTarget as HTMLInputElement).value)} onkeydown={handleCustomKeydown} />
      <button class="editor-button editor-button--accent inline-flex h-11 min-h-11 cursor-pointer items-center justify-center gap-[7px] border border-border bg-card px-3 font-display text-[0.68rem] font-[750] text-foreground hover:border-accent hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-[0.34]" type="button" onclick={addCustomValue}>Add</button>
    </div>
    {#if customError}<p class="canonical-selector__error m-0 text-[0.74rem] text-[#c2414d]" id={`${controlId}-custom-error`} role="alert">{customError}</p>{/if}
  {/if}

  {#if orderedValues.length > 0}
    <div class="canonical-selector__chips flex min-w-0 max-w-full flex-wrap gap-1.5" aria-label={`${label} selected values`}>
      {#each orderedValues as value (value.toLowerCase())}
        <span class="canonical-selector__chip inline-flex max-w-full items-center gap-1.5 rounded-[9999px]! border border-border bg-muted py-[3px] pl-2 pr-[5px] font-display text-[0.7rem] font-bold leading-[1.25] text-foreground [overflow-wrap:anywhere]">
          <span>{defenseLabel(kind, value)}</span>
          <button class="grid h-[22px] w-[22px] flex-none cursor-pointer place-items-center rounded-[50%]! border border-border bg-card text-[0.78rem] leading-none text-muted-foreground hover:border-[#c2414d] hover:text-[#c2414d]" type="button" aria-label={`Remove ${value}`} onclick={() => removeValue(value)}>×</button>
        </span>
      {/each}
    </div>
  {:else}
    <p class="canonical-selector__empty m-0 text-[0.74rem] text-muted-foreground">No {label.toLowerCase()} selected.</p>
  {/if}
</section>
