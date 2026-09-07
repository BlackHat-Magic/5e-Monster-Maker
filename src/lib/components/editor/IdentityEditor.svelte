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


	<section class="identity-strip grid min-w-0 gap-6 bg-background px-[clamp(18px,7vw,110px)] pt-[26px] pb-[28px] max-[920px]:pl-[max(clamp(18px,7vw,110px),calc(var(--section-rail-collapsed-width)+10px))] max-[500px]:px-[18px] max-[500px]:pt-6 max-[500px]:pb-7 max-[500px]:pl-[max(clamp(18px,7vw,110px),calc(var(--section-rail-collapsed-width)+10px))]" aria-labelledby="identity-heading">
	<div class="identity-strip__intro grid gap-[5px]">
		<h2 id="identity-heading" class="m-0 font-display text-[clamp(1.45rem,2.5vw,2.25rem)] leading-[0.95] tracking-[-0.08em]">Identity</h2>
		<p class="mt-[3px] mb-0 text-[0.78rem] text-muted-foreground">Name the creature, then decide how the stat block refers to it.</p>
	</div>

	<div class="identity-strip__fields grid min-w-0 grid-cols-[repeat(4,minmax(0,1fr))] gap-5 max-[760px]:grid-cols-[repeat(2,minmax(0,1fr))] max-[500px]:grid-cols-1">
		<Field id="monster-name" label="Name" help="The full name shown in the stat block and preview heading.">
			{#snippet children(control)}
				<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id="monster-name" type="text" value={$monster.name ?? ''} oninput={(event) => updateText('name', textValue(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
		<Field id="shortened-name" label="Shortened name" help="The name used in prose, including its article form such as 'a goblin'.">
			{#snippet children(control)}
				<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id="shortened-name" type="text" value={$monster.shortened_name ?? ''} oninput={(event) => updateText('shortened_name', textValue(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
		<Field id="shortened-plural" label="Shortened plural" help="The plural token used when prose refers to multiple creatures.">
			{#snippet children(control)}
				<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id="shortened-plural" type="text" value={$monster.shortened_plural ?? ''} oninput={(event) => updateText('shortened_plural', textValue(event))} aria-describedby={control.describedBy} aria-invalid={control.invalid} />
			{/snippet}
		</Field>
		<div class="editor-check-card grid content-center gap-1.5 border border-border bg-[color-mix(in_srgb,var(--muted)_38%,transparent)] p-[13px]">
			<div class="editor-check-card__label flex items-center gap-[7px]">
				<label class="editor-check inline-flex cursor-pointer items-center gap-2 font-display text-[0.76rem] font-bold text-foreground"><input class="h-[15px] w-[15px] accent-accent" type="checkbox" checked={$monster.proper_noun ?? false} onchange={(event) => updateFlag('proper_noun', event)} /><span>Proper noun</span></label>
				<FieldHelp label="Proper noun" help="When false, prose may use 'the' before shortened names. When true, the shortened name is treated as a proper noun." />
			</div>
		</div>
	</div>
</section>
