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

<section class="canonical-selector" aria-labelledby={`${controlId}-label`}>
  <div class="canonical-selector__heading">
    <div class="canonical-selector__label">
      <label id={`${controlId}-label`} for={controlId}>{label}</label>
      {#if help}<FieldHelp label={label} help={help} />{/if}
    </div>
    <span class="canonical-selector__count">{orderedValues.length.toString().padStart(2, '0')}</span>
  </div>

  <select class="editor-control canonical-selector__select" id={controlId} value={selectedValue} onchange={selectValue} aria-label={`Add ${label.toLowerCase()}`}>
    <option value="">Add a value...</option>
    {#each canonicalValues as value}
      <option value={value}>{defenseLabel(kind, value)}</option>
    {/each}
    <option value={otherValue}>Other</option>
  </select>

  {#if customMode}
    <div class="canonical-selector__custom">
      <input bind:this={customInputElement} class="editor-control" type="text" value={customValue} placeholder="Describe a custom defense" aria-label={`Custom ${label.toLowerCase()}`} aria-describedby={customError ? `${controlId}-custom-error` : undefined} aria-invalid={customError ? 'true' : undefined} oninput={(event) => (customValue = (event.currentTarget as HTMLInputElement).value)} onkeydown={handleCustomKeydown} />
      <button class="editor-button editor-button--accent" type="button" onclick={addCustomValue}>Add</button>
    </div>
    {#if customError}<p class="canonical-selector__error" id={`${controlId}-custom-error`} role="alert">{customError}</p>{/if}
  {/if}

  {#if orderedValues.length > 0}
    <div class="canonical-selector__chips" aria-label={`${label} selected values`}>
      {#each orderedValues as value (value.toLowerCase())}
        <span class="canonical-selector__chip">
          <span>{defenseLabel(kind, value)}</span>
          <button type="button" aria-label={`Remove ${value}`} onclick={() => removeValue(value)}>×</button>
        </span>
      {/each}
    </div>
  {:else}
    <p class="canonical-selector__empty">No {label.toLowerCase()} selected.</p>
  {/if}
</section>

<style>
  .canonical-selector { display: grid; gap: 12px; min-width: 0; }
  .canonical-selector__heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .canonical-selector__label { display: inline-flex; align-items: center; gap: 7px; }
  .canonical-selector__label label { color: var(--foreground); font-family: var(--font-display); font-size: 0.7rem; font-weight: 750; letter-spacing: 0.04em; text-transform: uppercase; }
  .canonical-selector__count { color: var(--accent); font-family: var(--font-display); font-size: 0.7rem; letter-spacing: 0.08em; }
  .canonical-selector__select { height: var(--editor-control-height); }
  .canonical-selector__custom { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
  .canonical-selector__chips { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; max-width: 100%; }
  .canonical-selector__chip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; border: 1px solid var(--border); border-radius: 9999px !important; background: var(--muted); padding: 3px 5px 3px 8px; color: var(--foreground); font-family: var(--font-display); font-size: 0.7rem; font-weight: 700; line-height: 1.25; overflow-wrap: anywhere; }
  .canonical-selector__chip button { display: inline-grid; width: 22px; height: 22px; flex: 0 0 auto; place-items: center; border: 1px solid var(--border); border-radius: 50% !important; background: var(--card); color: var(--muted-foreground); cursor: pointer; font-size: 0.78rem; line-height: 1; }
  .canonical-selector__chip button:hover { border-color: var(--danger); color: var(--danger); }
  .canonical-selector__empty, .canonical-selector__error { margin: 0; color: var(--muted-foreground); font-size: 0.74rem; }
  .canonical-selector__error { color: var(--danger); }
  @media (max-width: 500px) { .canonical-selector__custom { grid-template-columns: 1fr; } }
</style>
