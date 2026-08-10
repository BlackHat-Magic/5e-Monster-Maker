<script lang="ts">
	import { onMount } from 'svelte';
	import { monster as monsterStore } from '$lib/state/monster-store';
	import { createPreviewModel, type MonsterPreview } from '$lib/monster/preview';
	import type { Monster } from '$lib/monster/types';
	import AbilityTable from './AbilityTable.svelte';
	import PreviewActionSection from './PreviewActionSection.svelte';
	import PreviewField from './PreviewField.svelte';

	type PreviewModelFactory = (monster: Monster) => MonsterPreview;

	type Props = {
		monster?: Monster;
		createModel?: PreviewModelFactory;
	};

	type PreviewState =
		| { model: null; error: null }
		| { model: MonsterPreview; error: null }
		| { model: null; error: string };

	let { monster: suppliedMonster, createModel = createPreviewModel }: Props = $props();
	let isMounted = $state(false);
	let currentMonster = $derived(suppliedMonster ?? $monsterStore);
	let previewState = $derived.by((): PreviewState => {
		if (!isMounted) return { model: null, error: null };
		try {
			return { model: createModel(currentMonster), error: null };
		} catch (error) {
			return {
				model: null,
				error: error instanceof Error && error.message ? error.message : 'The preview model could not be created.',
			};
		}
	});
	let preview = $derived(previewState.model);
	let previewError = $derived(previewState.error);

	onMount(() => {
		isMounted = true;
	});

	function inlineHtml(value: { html: string }): string {
		return value.html.replace(/^<p>([\s\S]*)<\/p>\s*$/, '$1');
	}
</script>

	{#if !isMounted}
	<section class="preview-loading" aria-label="Preparing stat block preview">
		<h2>Preparing stat block</h2>
		<p>The live preview will appear as soon as the editor is ready.</p>
	</section>
	{:else if previewError}
	<section class="preview-error" role="alert" aria-labelledby="preview-error-heading">
		<h2 id="preview-error-heading">Preview could not be rendered</h2>
		<p>{previewError}</p>
		<p>The editor is still available. Continue editing and try the preview again.</p>
	</section>
{:else if preview}
	<article class="stat-block" aria-labelledby="stat-block-name">
		<header class="stat-block__header">
			<h2 id="stat-block-name">{@html inlineHtml(preview.name)}</h2>
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

		<AbilityTable abilities={preview.abilities} />

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
			<PreviewActionSection {section} />
		{/each}
	</article>
{/if}
