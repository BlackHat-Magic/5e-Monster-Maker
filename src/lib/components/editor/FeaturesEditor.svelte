<script lang="ts">
	import Field from './Field.svelte';
	import { monster } from '$lib/state/monster-store';

	type TextKey = 'legendary_description' | 'villain_description' | 'mythic_description';
	type FlagKey = 'is_legendary' | 'is_villain' | 'is_mythic';

	function textValue(event: Event): string {
		return (event.currentTarget as HTMLTextAreaElement).value;
	}

	function updateText(key: TextKey, value: string): void {
		monster.update((current) => ({ ...current, [key]: value }));
	}

	function updateFlag(key: FlagKey, event: Event): void {
		monster.update((current) => ({ ...current, [key]: (event.currentTarget as HTMLInputElement).checked }));
	}
</script>

<section class="editor-section" aria-labelledby="features-heading">
	<div class="editor-section__intro">
		<p class="section-label">02 / Features</p>
		<h2 id="features-heading">Features</h2>
		<p>Set the special classifications and section introductions used by legendary, villain, and mythic stat blocks.</p>
	</div>

	<div class="editor-flags">
		<div class="editor-flag">
			<label class="editor-check"><input type="checkbox" checked={$monster.is_legendary ?? false} onchange={(event) => updateFlag('is_legendary', event)} /><span>Legendary</span></label>
			<Field id="legendary-description" label="Legendary description">
				{#snippet children(control)}
					<textarea class="editor-control editor-control--area" id="legendary-description" rows="3" value={$monster.legendary_description ?? ''} oninput={(event) => updateText('legendary_description', textValue(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid}></textarea>
				{/snippet}
			</Field>
		</div>
		<div class="editor-flag">
			<label class="editor-check"><input type="checkbox" checked={$monster.is_villain ?? false} onchange={(event) => updateFlag('is_villain', event)} /><span>Villain</span></label>
			<Field id="villain-description" label="Villain description">
				{#snippet children(control)}
					<textarea class="editor-control editor-control--area" id="villain-description" rows="3" value={$monster.villain_description ?? ''} oninput={(event) => updateText('villain_description', textValue(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid}></textarea>
				{/snippet}
			</Field>
		</div>
		<div class="editor-flag">
			<label class="editor-check"><input type="checkbox" checked={$monster.is_mythic ?? false} onchange={(event) => updateFlag('is_mythic', event)} /><span>Mythic</span></label>
			<Field id="mythic-description" label="Mythic description">
				{#snippet children(control)}
					<textarea class="editor-control editor-control--area" id="mythic-description" rows="3" value={$monster.mythic_description ?? ''} oninput={(event) => updateText('mythic_description', textValue(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid}></textarea>
				{/snippet}
			</Field>
		</div>
	</div>
</section>
