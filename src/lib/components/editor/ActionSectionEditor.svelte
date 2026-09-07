<script lang="ts" generics="K extends ActionArrayKey">
	import Field from './Field.svelte';
	import FieldHelp from './FieldHelp.svelte';
	import RepeatableList from './RepeatableList.svelte';
	import ActionCard from './ActionCard.svelte';
	import { monster } from '$lib/state/monster-store';
	import type { ActionItem } from '$lib/monster/types';
	import { createDefaultAction, type ActionArrayKey, type IntroDescriptionKey, updateActionArray, updateIntroDescription } from './action-editor-core';

	type Props = {
		target: K;
		sectionTitle: string;
		sectionDescription?: string;
		addLabel?: string;
		specialFlagKey?: 'is_legendary' | 'is_villain' | 'is_mythic';
		introDescriptionKey?: IntroDescriptionKey;
		introDescriptionLabel?: string;
	};

	let {
		target,
		sectionTitle,
		sectionDescription = 'Build the entries in display order. Each action can be custom text or a generated rules preset.',
		addLabel,
		specialFlagKey,
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

	function updateSpecialFlag(event: Event): void {
		if (!specialFlagKey) return;
		const checked = (event.currentTarget as HTMLInputElement).checked;
		monster.update((current) => ({ ...current, [specialFlagKey]: checked }));
	}

	const defaultAddLabels: Record<ActionArrayKey, string> = {
		ability: 'Add trait',
		action: 'Add action',
		bonus_action: 'Add bonus action',
		reaction: 'Add reaction',
		legendary_action: 'Add legendary action',
		villain_action: 'Add villain action',
		mythic_action: 'Add mythic action',
	};

	let resolvedAddLabel = $derived(addLabel ?? defaultAddLabels[target]);
	const mcdmLink = 'https://shop.mcdmproductions.com/products/flee-mortals-the-mcdm-monster-book-hardcover-pdf';
</script>

	<section class="editor-section action-section grid min-w-0 gap-[34px]" data-testid={`editor-section-${target}`} aria-labelledby={`${target}-heading`}>
	{#if specialFlagKey}
		<div class="action-section__special-header flex min-h-8 items-center gap-[7px]">
			<label class="editor-check inline-flex cursor-pointer items-center gap-2 font-display text-[0.76rem] font-bold text-foreground" for={`${target}-enabled`}><input id={`${target}-enabled`} type="checkbox" checked={$monster[specialFlagKey] ?? false} onchange={updateSpecialFlag} /><span>{sectionTitle}</span></label>
			{#if specialFlagKey === 'is_villain'}
				<FieldHelp label="Villain" help="Enable this feature and add introductory text for villain actions." link={{ href: mcdmLink, label: 'Official MCDM book' }} />
			{/if}
		</div>
	{:else}
		<div class="editor-section__intro grid gap-2.5">
			<p class="m-0 max-w-[600px] text-[0.9rem] leading-[1.65] text-muted-foreground">{sectionDescription}</p>
		</div>
	{/if}

	{#if introDescriptionKey}
		<Field id={`${target}-intro`} label={introDescriptionLabel} help="Markdown and monster tokens are supported in this section text.">
			{#snippet children(control)}
				<textarea class="editor-control editor-control--area max-w-full w-full border border-border bg-card px-3 py-2.5 text-[0.88rem] leading-[1.4] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0 h-[116px] min-h-[116px] resize-y" id={`${target}-intro`} rows="3" value={$monster[introDescriptionKey] ?? ''} oninput={updateIntro} aria-describedby={control.describedBy} aria-invalid={control.invalid}></textarea>
			{/snippet}
		</Field>
	{/if}

	<RepeatableList
		headingId={`${target}-heading`}
		headingTag="h2"
		label={sectionTitle}
		addLabel={resolvedAddLabel}
		items={items}
		createItem={createDefaultAction}
		getItemName={(item) => item.name}
		onItemsChange={updateItems}
	>
		{#snippet children(item, index, update)}
			<ActionCard item={item} index={index} target={target} onChange={update} />
		{/snippet}
	</RepeatableList>
</section>


