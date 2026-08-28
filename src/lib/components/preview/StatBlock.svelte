<script lang="ts">
	import type { MonsterPreview } from '$lib/monster/preview';
	import { statBlockThemeStyle, type StatBlockThemeKey } from '$lib/theme/stat-block-themes';
	import AbilityTable from './AbilityTable.svelte';
	import PreviewActionSection from './PreviewActionSection.svelte';
	import PreviewField from './PreviewField.svelte';

	type Props = {
		preview: MonsterPreview;
		theme: StatBlockThemeKey;
		idPrefix: string;
	};

	let { preview, theme, idPrefix }: Props = $props();

	function inlineHtml(value: { html: string }): string {
		return value.html.replace(/^<p>([\s\S]*)<\/p>\s*$/, '$1');
	}
</script>

<article class="stat-block" aria-labelledby={`${idPrefix}-stat-block-name`} data-stat-block-theme={theme} style={statBlockThemeStyle(theme)}>
	<header class="stat-block__header">
		<h2 id={`${idPrefix}-stat-block-name`}>{@html inlineHtml(preview.name)}</h2>
		{#if preview.meta}
			<div class="stat-block__meta">{@html preview.meta.html}</div>
		{/if}
		{#if preview.flavor}
			<div class="stat-block__flavor">{@html preview.flavor.html}</div>
		{/if}
	</header>

	<div class="stat-block__rule" aria-hidden="true"></div>

	<section class="stat-block__core" aria-label="Core statistics">
		<PreviewField field={preview.armorClass} />
		<PreviewField field={preview.hitPoints} />
		<PreviewField field={preview.speed} />
	</section>

	<div class="stat-block__rule" aria-hidden="true"></div>

	<AbilityTable abilities={preview.abilities} {idPrefix} />

	<div class="stat-block__rule" aria-hidden="true"></div>

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

	{#each preview.sections as section (section.key)}
		<PreviewActionSection {section} {idPrefix} />
	{/each}
</article>
