<script lang="ts">
	import { onMount } from 'svelte';
	import { monster as monsterStore } from '$lib/state/monster-store';
	import { createPreviewModel, type MonsterPreview } from '$lib/monster/preview';
	import { previewTheme } from '$lib/state/theme-store';
	import type { Monster } from '$lib/monster/types';
	import StatBlock from './StatBlock.svelte';

	type PreviewModelFactory = (monster: Monster) => MonsterPreview;

	type Props = {
		monster?: Monster;
		createModel?: PreviewModelFactory;
		idPrefix?: string;
	};

	type PreviewState =
		| { model: null; error: null }
		| { model: MonsterPreview; error: null }
		| { model: null; error: string };

	let { monster: suppliedMonster, createModel = createPreviewModel, idPrefix = 'live-preview' }: Props = $props();
	let isMounted = $state(false);
	let errorHeadingId = $derived(`${idPrefix}-error-heading`);
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

</script>

	{#if !isMounted}
	<section class="preview-loading" aria-label="Preparing stat block preview">
		<h2>Preparing stat block</h2>
		<p>The live preview will appear as soon as the editor is ready.</p>
	</section>
	{:else if previewError}
	<section class="preview-error" role="alert" aria-labelledby={errorHeadingId}>
		<h2 id={errorHeadingId}>Preview could not be rendered</h2>
		<p>{previewError}</p>
		<p>The editor is still available. Continue editing and try the preview again.</p>
	</section>
	{:else if preview}
	<StatBlock preview={preview} theme={$previewTheme} {idPrefix} />
{/if}
