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

<div class="field grid gap-[7px]" aria-describedby={describedBy} aria-invalid={error ? 'true' : undefined}>
	<div class="field__heading flex items-center justify-between gap-3">
		<div class="field__label inline-flex items-center gap-[7px]">
			<label class="font-display text-[0.7rem] font-[750] tracking-[0.04em] text-foreground uppercase" for={id}>{label}</label>
			{#if help}<FieldHelp id={helpId} label={label} help={help} />{/if}
		</div>
		{#if error}<span class="field__error-mark grid h-4 w-4 place-items-center bg-[#c2414d] font-display text-[0.64rem] font-extrabold text-white">!</span>{/if}
	</div>
	{@render children({ describedBy, invalid: Boolean(error) })}
	{#if error}
		<p class="field__error m-0 text-[0.74rem] text-[#c2414d]" id={errorId}>{error}</p>
	{/if}
</div>
