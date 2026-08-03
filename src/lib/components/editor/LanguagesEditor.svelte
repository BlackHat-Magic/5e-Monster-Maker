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

<section class="editor-section" aria-labelledby="languages-heading">
	<div class="editor-section__intro">
		<p class="section-label">06 / Communication</p>
		<h2 id="languages-heading">Languages</h2>
		<p>Record what the creature speaks and what it understands, in display order.</p>
	</div>
	<RepeatableList label="Languages" addLabel="Add language" items={$monster.language ?? []} createItem={createLanguage} getItemName={(item) => item.name} onItemsChange={updateLanguages}>
		{#snippet children(item, index, update)}
			<div class="editor-grid editor-grid--three">
				<Field id={`language-name-${index}`} label="Name">
					{#snippet children(control)}<input class="editor-control" id={`language-name-${index}`} type="text" value={item.name} oninput={(event) => update({ ...item, name: (event.currentTarget as HTMLInputElement).value })} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
				<Field id={`language-status-${index}`} label="Status">
					{#snippet children(control)}
						<select class="editor-control" id={`language-status-${index}`} value={item.status} onchange={(event) => update({ ...item, status: (event.currentTarget as HTMLSelectElement).value as LanguageEntry['status'] })} aria-describedby={control.describedBy} aria-invalid={control.invalid}>
							<option value="speaks">Speaks</option><option value="understands">Understands</option>
						</select>
					{/snippet}
				</Field>
				<Field id={`language-but-${index}`} label="But">
					{#snippet children(control)}<input class="editor-control" id={`language-but-${index}`} type="text" value={item.but ?? ''} placeholder="optional qualifier" oninput={(event) => update({ ...item, but: (event.currentTarget as HTMLInputElement).value })} aria-describedby={control.describedBy} aria-invalid={control.invalid} />{/snippet}
				</Field>
			</div>
		{/snippet}
	</RepeatableList>
</section>
