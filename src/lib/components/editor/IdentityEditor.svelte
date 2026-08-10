<script lang="ts">
	import Field from './Field.svelte';
	import FieldHelp from './FieldHelp.svelte';
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


	<section class="identity-strip" aria-labelledby="identity-heading">
	<div class="identity-strip__intro">
		<h2 id="identity-heading">Identity</h2>
		<p>Name the creature, then decide how the stat block refers to it.</p>
	</div>

	<div class="identity-strip__fields">
		<Field id="monster-name" label="Name" help="The full name shown in the stat block and preview heading.">
			{#snippet children(control)}
				<input class="editor-control" id="monster-name" type="text" value={$monster.name ?? ''} oninput={(event) => updateText('name', textValue(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
		<Field id="shortened-name" label="Shortened name" help="The name used in prose, including its article form such as 'a goblin'.">
			{#snippet children(control)}
				<input class="editor-control" id="shortened-name" type="text" value={$monster.shortened_name ?? ''} oninput={(event) => updateText('shortened_name', textValue(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
		<Field id="shortened-plural" label="Shortened plural" help="The plural token used when prose refers to multiple creatures.">
			{#snippet children(control)}
				<input class="editor-control" id="shortened-plural" type="text" value={$monster.shortened_plural ?? ''} oninput={(event) => updateText('shortened_plural', textValue(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
		<div class="editor-check-card">
			<div class="editor-check-card__label">
				<label class="editor-check"><input type="checkbox" checked={$monster.proper_noun ?? false} onchange={(event) => updateFlag('proper_noun', event)} /><span>Proper noun</span></label>
				<FieldHelp label="Proper noun" help="When false, prose may use 'the' before shortened names. When true, the shortened name is treated as a proper noun." />
			</div>
		</div>
	</div>
</section>

<style>
	.identity-strip { display: grid; gap: 24px; min-width: 0; background: var(--bg); padding: 26px clamp(18px, 7vw, 110px) 28px; }
	.identity-strip__intro { display: grid; gap: 5px; }
	.identity-strip__intro h2 { margin: 0; font-family: var(--font-display); font-size: clamp(1.45rem, 2.5vw, 2.25rem); line-height: 0.95; letter-spacing: -0.08em; }
	.identity-strip__intro p:last-child { margin: 3px 0 0; color: var(--muted-foreground); font-size: 0.78rem; }
	.identity-strip__fields { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; min-width: 0; }
	.editor-check-card__label { display: flex; align-items: center; gap: 7px; }
	@media (max-width: 760px) { .identity-strip__fields { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	@media (max-width: 920px) { .identity-strip { padding-left: max(clamp(18px, 7vw, 110px), calc(var(--section-rail-collapsed-width) + 10px)); } }
	@media (max-width: 500px) { .identity-strip { padding: 24px 18px 28px max(clamp(18px, 7vw, 110px), calc(var(--section-rail-collapsed-width) + 10px)); } .identity-strip__fields { grid-template-columns: 1fr; } }
</style>
