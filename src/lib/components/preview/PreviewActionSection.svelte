<script lang="ts">
	import type { PreviewSection } from '$lib/monster/preview';

	type Props = {
		section: PreviewSection;
		idPrefix: string;
		measured?: boolean;
	};

	let { section, idPrefix, measured = false }: Props = $props();
	let headingId = $derived(section.title ? `${idPrefix}-heading-${section.key}` : undefined);
	let sectionMarker = $derived(`${section.key}:${section.fragmentStart ?? 0}:${section.fragmentEnd ?? section.items.length}`);
</script>

<section class:preview-section--traits={section.key === 'ability'} class="preview-section" data-stat-block-section={measured ? section.key : undefined} data-stat-block-section-fragment={measured ? sectionMarker : undefined} aria-labelledby={headingId} aria-label={headingId ? undefined : section.ariaLabel || (section.key === 'ability' ? 'Traits' : section.key)}>
	{#if section.title}
		<h3 id={headingId}>{section.title}</h3>
	{/if}

	{#if section.intro}
		<div class="preview-section__intro">{@html section.intro.html}</div>
	{/if}

	<div class="preview-section__items">
		{#each section.items as item, itemIndex}
			<div class="preview-action" data-stat-block-item={measured ? `${section.key}:${(section.fragmentStart ?? 0) + itemIndex}` : undefined}>{@html item.html}</div>
		{/each}
	</div>
</section>
