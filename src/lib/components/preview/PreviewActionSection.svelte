<script lang="ts">
	import type { PreviewSection } from '$lib/monster/preview';

	type Props = {
		section: PreviewSection;
		idPrefix: string;
	};

	let { section, idPrefix }: Props = $props();
	let headingId = $derived(`${idPrefix}-heading-${section.key}`);
</script>

<section class:preview-section--traits={section.key === 'ability'} class="preview-section" aria-labelledby={section.key === 'ability' ? undefined : headingId} aria-label={section.key === 'ability' ? 'Traits' : undefined}>
	{#if section.title}
		<h3 id={headingId}>{section.title}</h3>
	{/if}

	{#if section.intro}
		<div class="preview-section__intro">{@html section.intro.html}</div>
	{/if}

	<div class="preview-section__items">
		{#each section.items as item}
			<div class="preview-action">{@html item.html}</div>
		{/each}
	</div>
</section>
