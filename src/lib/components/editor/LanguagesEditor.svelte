<script lang="ts">
	import Field from './Field.svelte';
	import RepeatableList from './RepeatableList.svelte';
	import { monster } from '$lib/state/monster-store';
	import type { LanguageEntry } from '$lib/monster/types';

	function createLanguage(): LanguageEntry {
		return { name: '', status: 'speaks', but: '' };
	}

	function updateLanguages(items: LanguageEntry[]): void {
		monster.update((current) => ({ ...current, language: items.map((item) => ({ ...item })) }));
	}
</script>

	<section class="editor-section grid min-w-0 gap-[34px]" aria-labelledby="languages-heading">
	<div class="editor-section__intro grid gap-2.5">
		<h2 id="languages-heading" class="m-0 font-display text-[clamp(1.9rem,3.8vw,3.25rem)] leading-[0.96] tracking-[-0.08em]">Languages</h2>
		<p class="m-0 max-w-[600px] text-[0.9rem] leading-[1.65] text-muted-foreground">Record what the creature speaks and what it understands, in display order.</p>
	</div>
	<RepeatableList label="Languages" addLabel="Add language" items={$monster.language ?? []} createItem={createLanguage} getItemName={(item) => item.name} onItemsChange={updateLanguages}>
		{#snippet children(item, index, update)}
			<div class="editor-grid editor-grid--three grid min-w-0 gap-[22px] grid-cols-[repeat(3,minmax(0,1fr))] max-[500px]:grid-cols-1">
				<Field id={`language-name-${index}`} label="Name" help="The language this creature speaks or understands.">
					{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`language-name-${index}`} type="text" value={item.name} oninput={(event) => update({ ...item, name: (event.currentTarget as HTMLInputElement).value })} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
				<Field id={`language-status-${index}`} label="Status" help="Whether the creature speaks or only understands this language.">
					{#snippet children(control)}
						<select class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`language-status-${index}`} value={item.status} onchange={(event) => update({ ...item, status: (event.currentTarget as HTMLSelectElement).value as LanguageEntry['status'] })} aria-describedby={control.describedBy} aria-invalid={control.invalid}>
							<option value="speaks">Speaks</option><option value="understands">Understands</option>
						</select>
					{/snippet}
				</Field>
				<Field id={`language-but-${index}`} label="But" help="An optional qualifier, such as a limitation or preferred language.">
					{#snippet children(control)}<input class="editor-control h-11 max-w-full min-h-11 w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0" id={`language-but-${index}`} type="text" value={item.but ?? ''} placeholder="optional qualifier" oninput={(event) => update({ ...item, but: (event.currentTarget as HTMLInputElement).value })} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
			</div>
		{/snippet}
	</RepeatableList>
</section>
