<script lang="ts">
	import Field from './Field.svelte';
	import { monster } from '$lib/state/monster-store';
	import type { SizeName } from '$lib/monster/types';

	const sizes: Array<{ value: SizeName; label: string }> = [
		{ value: 'tiny', label: 'Tiny' },
		{ value: 'small', label: 'Small' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'large', label: 'Large' },
		{ value: 'huge', label: 'Huge' },
		{ value: 'gargantuan', label: 'Gargantuan' },
	];

	type BasicsKey = 'size' | 'type' | 'tag' | 'alignment' | 'flavor';

	function valueOf(event: Event): string {
		return (event.currentTarget as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
	}

	function updateBasics(key: BasicsKey, value: string): void {
		monster.update((current) => ({ ...current, basics: { ...current.basics, [key]: value } }));
	}

	function updateTwoColumn(event: Event): void {
		monster.update((current) => ({ ...current, two_column: (event.currentTarget as HTMLInputElement).checked }));
	}
</script>

	<section class="editor-section grid min-w-0 gap-[34px]" aria-labelledby="basics-heading">
	<div class="editor-section__intro grid gap-2.5">
		<h2 id="basics-heading" class="m-0 font-display text-[clamp(1.9rem,3.8vw,3.25rem)] leading-[0.96] tracking-[-0.08em]">Basics</h2>
		<p class="m-0 max-w-[600px] text-[0.9rem] leading-[1.65] text-muted-foreground">Give the creature its physical category, taxonomy, and opening flavor.</p>
	</div>
	<div class="editor-grid editor-grid--two grid min-w-0 gap-[22px] grid-cols-[repeat(2,minmax(0,1fr))] max-[500px]:grid-cols-1">
		<Field id="monster-size" label="Size" help="The creature's size category, from Tiny to Gargantuan.">
			{#snippet children(control)}
				<select class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id="monster-size" value={$monster.basics?.size ?? 'medium'} onchange={(event) => updateBasics('size', valueOf(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid}>
					{#each sizes as size}<option value={size.value}>{size.label}</option>{/each}
				</select>
			{/snippet}
		</Field>
		<Field id="monster-type" label="Type" help="The creature type shown beside its size and alignment.">
			{#snippet children(control)}
				<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id="monster-type" type="text" value={$monster.basics?.type ?? ''} oninput={(event) => updateBasics('type', valueOf(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
		<Field id="monster-tag" label="Tag" help="An optional subtype, such as shapechanger or goblinoid.">
			{#snippet children(control)}
				<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id="monster-tag" type="text" value={$monster.basics?.tag ?? ''} oninput={(event) => updateBasics('tag', valueOf(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
		<Field id="monster-alignment" label="Alignment" help="The alignment displayed in the stat block header.">
			{#snippet children(control)}
				<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id="monster-alignment" type="text" value={$monster.basics?.alignment ?? ''} oninput={(event) => updateBasics('alignment', valueOf(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
	</div>
	<div class="editor-check-card editor-check-card--inline grid content-center gap-1.5 gap-x-[9px] border border-border bg-[color-mix(in_srgb,var(--muted)_38%,transparent)] p-[13px] grid-cols-[auto_1fr]">
		<label class="editor-check inline-flex cursor-pointer items-center gap-2 font-display text-[0.76rem] font-bold text-foreground" for="monster-two-column"><input id="monster-two-column" type="checkbox" checked={$monster.two_column ?? false} onchange={updateTwoColumn} /><span>Two-column stat block</span></label>
	</div>
	<Field id="monster-flavor" label="Flavor text" help="A compact opening description for the generated stat block.">
		{#snippet children(control)}
			<textarea class="editor-control editor-control--area max-w-full w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0 h-[116px] min-h-[116px] resize-y" id="monster-flavor" rows="5" value={$monster.basics?.flavor ?? ''} oninput={(event) => updateBasics('flavor', valueOf(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid}></textarea>
		{/snippet}
	</Field>
</section>
