<script lang="ts">
	import type { Snippet } from 'svelte';
	import FieldHelp from './FieldHelp.svelte';

	export type FieldControlProps = {
		describedBy: string | undefined;
		invalid: boolean;
	};

	type Props = {
		id: string;
		label: string;
		help?: string;
		error?: string;
		children: Snippet<[FieldControlProps]>;
	};

	let { id, label, help = '', error = '', children }: Props = $props();
	let helpId = $derived(help ? `${id}-help` : undefined);
	let errorId = $derived(error ? `${id}-error` : undefined);
	let describedBy = $derived([helpId, errorId].filter(Boolean).join(' ') || undefined);
</script>

<div class="field" aria-describedby={describedBy} aria-invalid={error ? 'true' : undefined}>
	<div class="field__heading">
		<div class="field__label">
			<label for={id}>{label}</label>
			{#if help}<FieldHelp id={helpId} label={label} help={help} />{/if}
		</div>
		{#if error}<span class="field__error-mark">!</span>{/if}
	</div>
	{@render children({ describedBy, invalid: Boolean(error) })}
	{#if error}
		<p class="field__error" id={errorId}>{error}</p>
	{/if}
</div>

<style>
	.field { display: grid; gap: 7px; }
	.field__heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.field__label { display: inline-flex; align-items: center; gap: 7px; }
	.field__heading label { color: var(--foreground); font-family: var(--font-display); font-size: 0.7rem; font-weight: 750; letter-spacing: 0.04em; text-transform: uppercase; }
	.field__error-mark { display: grid; width: 16px; height: 16px; place-items: center; background: #c2414d; color: #fff; font-family: var(--font-display); font-size: 0.64rem; font-weight: 800; }
	.field__error { margin: 0; color: #c2414d; font-size: 0.74rem; }
</style>
