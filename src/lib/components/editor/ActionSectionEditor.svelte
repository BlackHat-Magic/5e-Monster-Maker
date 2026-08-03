<script lang="ts" generics="K extends ActionArrayKey">
	import Field from './Field.svelte';
	import RepeatableList from './RepeatableList.svelte';
	import ActionCard from './ActionCard.svelte';
	import { monster } from '$lib/state/monster-store';
	import type { ActionItem } from '$lib/monster/types';
	import { createDefaultAction, type ActionArrayKey, type IntroDescriptionKey, updateActionArray, updateIntroDescription } from './action-editor-core';

	type Props = {
		target: K;
		sectionTitle: string;
		sectionNumber?: string;
		sectionDescription?: string;
		introDescriptionKey?: IntroDescriptionKey;
		introDescriptionLabel?: string;
	};

	let {
		target,
		sectionTitle,
		sectionNumber = '07 / Combat',
		sectionDescription = 'Build the entries in display order. Each action can be custom text or a generated rules preset.',
		introDescriptionKey,
		introDescriptionLabel = 'Section introduction',
	}: Props = $props();

	let items = $derived(($monster[target] ?? []) as ActionItem[]);

	function updateItems(next: ActionItem[]): void {
		monster.update((current) => updateActionArray(current, target, next));
	}

	function updateIntro(event: Event): void {
		if (!introDescriptionKey) return;
		const value = (event.currentTarget as HTMLTextAreaElement).value;
		monster.update((current) => updateIntroDescription(current, introDescriptionKey, value));
	}
</script>

<section class="editor-section action-section" data-testid={`editor-section-${target}`} aria-labelledby={`${target}-heading`}>
	<div class="editor-section__intro">
		<p class="section-label">{sectionNumber}</p>
		<h2 id={`${target}-heading`}>{sectionTitle}</h2>
		<p>{sectionDescription}</p>
	</div>

	{#if introDescriptionKey}
		<Field id={`${target}-intro`} label={introDescriptionLabel} description="Markdown and monster tokens are supported in this section text.">
			{#snippet children(control)}
				<textarea class="editor-control editor-control--area" id={`${target}-intro`} rows="3" value={$monster[introDescriptionKey] ?? ''} oninput={updateIntro} aria-describedby={control.describedBy} aria-invalid={control.invalid}></textarea>
			{/snippet}
		</Field>
	{/if}

	<RepeatableList
		label={sectionTitle}
		addLabel={`Add ${sectionTitle.toLowerCase().replace(/s$/, '')}`}
		items={items}
		createItem={createDefaultAction}
		getItemName={(item) => item.name}
		onItemsChange={updateItems}
	>
		{#snippet children(item, index, update)}
			<ActionCard item={item} index={index} onChange={update} />
		{/snippet}
	</RepeatableList>
</section>
