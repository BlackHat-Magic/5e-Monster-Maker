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
</script>

	<section class="editor-section" aria-labelledby="basics-heading">
	<div class="editor-section__intro">
		<h2 id="basics-heading">Basics</h2>
		<p>Give the creature its physical category, taxonomy, and opening flavor.</p>
	</div>
	<div class="editor-grid editor-grid--two">
		<Field id="monster-size" label="Size" help="The creature's size category, from Tiny to Gargantuan.">
			{#snippet children(control)}
				<select class="editor-control" id="monster-size" value={$monster.basics?.size ?? 'medium'} onchange={(event) => updateBasics('size', valueOf(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid}>
					{#each sizes as size}<option value={size.value}>{size.label}</option>{/each}
				</select>
			{/snippet}
		</Field>
		<Field id="monster-type" label="Type" help="The creature type shown beside its size and alignment.">
			{#snippet children(control)}
				<input class="editor-control" id="monster-type" type="text" value={$monster.basics?.type ?? ''} oninput={(event) => updateBasics('type', valueOf(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
		<Field id="monster-tag" label="Tag" help="An optional subtype, such as shapechanger or goblinoid.">
			{#snippet children(control)}
				<input class="editor-control" id="monster-tag" type="text" value={$monster.basics?.tag ?? ''} oninput={(event) => updateBasics('tag', valueOf(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
		<Field id="monster-alignment" label="Alignment" help="The alignment displayed in the stat block header.">
			{#snippet children(control)}
				<input class="editor-control" id="monster-alignment" type="text" value={$monster.basics?.alignment ?? ''} oninput={(event) => updateBasics('alignment', valueOf(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
	</div>
	<Field id="monster-flavor" label="Flavor text" help="A compact opening description for the generated stat block.">
		{#snippet children(control)}
			<textarea class="editor-control editor-control--area" id="monster-flavor" rows="5" value={$monster.basics?.flavor ?? ''} oninput={(event) => updateBasics('flavor', valueOf(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid}></textarea>
		{/snippet}
	</Field>
</section>
