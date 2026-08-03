<script lang="ts">
	import Field from './Field.svelte';
	import { monster } from '$lib/state/monster-store';

	type TextKey = 'name' | 'shortened_name' | 'shortened_plural';
	type FlagKey = 'proper_noun';

	function textValue(event: Event): string {
		return (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
	}

	function updateText(key: TextKey, value: string): void {
		monster.update((current) => ({ ...current, [key]: value }));
	}

	function updateFlag(key: FlagKey, event: Event): void {
		monster.update((current) => ({ ...current, [key]: (event.currentTarget as HTMLInputElement).checked }));
	}

</script>

<section class="editor-section" aria-labelledby="identity-heading">
	<div class="editor-section__intro">
		<p class="section-label">01 / Foundation</p>
		<h2 id="identity-heading">Identity</h2>
		<p>Name the creature, then decide how the stat block refers to it.</p>
	</div>

	<div class="editor-grid editor-grid--two">
		<Field id="monster-name" label="Name" description="The full name shown in the stat block.">
			{#snippet children(control)}
				<input class="editor-control" id="monster-name" type="text" value={$monster.name ?? ''} oninput={(event) => updateText('name', textValue(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
		<Field id="shortened-name" label="Shortened name">
			{#snippet children(control)}
				<input class="editor-control" id="shortened-name" type="text" value={$monster.shortened_name ?? ''} oninput={(event) => updateText('shortened_name', textValue(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
		<Field id="shortened-plural" label="Shortened plural">
			{#snippet children(control)}
				<input class="editor-control" id="shortened-plural" type="text" value={$monster.shortened_plural ?? ''} oninput={(event) => updateText('shortened_plural', textValue(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
		<div class="editor-check-card">
			<label class="editor-check"><input type="checkbox" checked={$monster.proper_noun ?? false} onchange={(event) => updateFlag('proper_noun', event)} /><span>Proper noun</span></label>
			<p>Keep the name capitalized when prose refers to this creature.</p>
		</div>
	</div>
</section>
