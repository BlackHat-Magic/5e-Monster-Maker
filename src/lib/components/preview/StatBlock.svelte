<script lang="ts">
	import { splitPreviewSections, type MonsterPreview, type PreviewSection } from '$lib/monster/preview';
	import { statBlockThemeStyle, type StatBlockThemeKey } from '$lib/theme/stat-block-themes';
	import AbilityTable from './AbilityTable.svelte';
	import PreviewActionSection from './PreviewActionSection.svelte';
	import PreviewField from './PreviewField.svelte';

	type Props = {
		preview: MonsterPreview;
		theme: StatBlockThemeKey;
		idPrefix: string;
		twoColumn?: boolean;
	};

	let { preview, theme, idPrefix, twoColumn = false }: Props = $props();
	let sectionColumns = $derived(splitPreviewSections(preview));

	function inlineHtml(value: { html: string }): string {
		return value.html.replace(/^<p>([\s\S]*)<\/p>\s*$/, '$1');
	}
</script>

{#snippet header()}
	<header class="stat-block__header">
		<h2 id={`${idPrefix}-stat-block-name`}>{@html inlineHtml(preview.name)}</h2>
		{#if preview.meta}
			<div class="stat-block__meta">{@html preview.meta.html}</div>
		{/if}
		{#if preview.flavor}
			<div class="stat-block__flavor">{@html preview.flavor.html}</div>
		{/if}
	</header>
{/snippet}

{#snippet coreStats()}
	<section class="stat-block__core" aria-label="Core statistics">
		<PreviewField field={preview.armorClass} />
		<PreviewField field={preview.hitPoints} />
		<PreviewField field={preview.speed} />
	</section>
{/snippet}

{#snippet lowerFlow(sections: PreviewSection[])}
	<section class="stat-block__fields" aria-label="Additional statistics">
		{#each preview.fields as field}
			<PreviewField {field} />
		{/each}
	</section>

	<div class="stat-block__challenge" aria-label="Challenge and proficiency bonus">
		<span>Challenge {preview.challenge.challenge} ({preview.challenge.xpText} XP)</span>
		<span class="stat-block__prof-bonus"><strong>Proficiency Bonus</strong> {preview.challenge.proficiencyBonusText}</span>
	</div>
	<div class="stat-block__rule stat-block__rule--thin" aria-hidden="true"></div>

	{#each sections as section (section.key)}
		<PreviewActionSection {section} {idPrefix} />
	{/each}
{/snippet}

<article class="stat-block" class:stat-block--two-column={twoColumn} aria-labelledby={`${idPrefix}-stat-block-name`} data-stat-block-theme={theme} style={statBlockThemeStyle(theme)}>
	{#if twoColumn}
		<div class="stat-block__panels">
			<div class="stat-block__panel stat-block__panel--left">
				{@render header()}
				<div class="stat-block__rule" aria-hidden="true"></div>
				{@render coreStats()}
				<div class="stat-block__rule" aria-hidden="true"></div>
				<AbilityTable abilities={preview.abilities} {idPrefix} />
				<div class="stat-block__rule" aria-hidden="true"></div>
				{@render lowerFlow(sectionColumns.left)}
			</div>
			<div class="stat-block__panel stat-block__panel--right">
				{#each sectionColumns.right as section (section.key)}
					<PreviewActionSection {section} {idPrefix} />
				{/each}
			</div>
		</div>
	{:else}
		{@render header()}
		<div class="stat-block__rule" aria-hidden="true"></div>
		{@render coreStats()}
		<div class="stat-block__rule" aria-hidden="true"></div>
		<AbilityTable abilities={preview.abilities} {idPrefix} />
		<div class="stat-block__rule" aria-hidden="true"></div>
		{@render lowerFlow(preview.sections)}
	{/if}
</article>
