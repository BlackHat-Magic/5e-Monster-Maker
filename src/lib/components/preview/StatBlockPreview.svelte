<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { get } from 'svelte/store';
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
	let liveMonster = $derived(suppliedMonster ?? $monsterStore);
	// Debounce the expensive preview rebuild (markdown + column balancing) so
	// fast typing commits one model per pause instead of one per keystroke.
	const PREVIEW_DEBOUNCE_MS = 120;
	let debouncedMonster = $state<Monster>(untrack(() => liveMonster));
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	// Cheap change signature captured at setup. String comparison detects content
	// changes without ever ===-comparing $state proxies (which Svelte warns about).
	let lastSignature = untrack(() => JSON.stringify(liveMonster));

	$effect(() => {
		const next = liveMonster;
		const signature = JSON.stringify(next);
		if (signature === lastSignature) return;
		lastSignature = signature;
		if (debounceTimer !== null) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debouncedMonster = next;
			debounceTimer = null;
		}, PREVIEW_DEBOUNCE_MS);
		return () => {
			if (debounceTimer !== null) {
				clearTimeout(debounceTimer);
				debounceTimer = null;
			}
		};
	});
	let previewState = $derived.by((): PreviewState => {
		if (!isMounted) return { model: null, error: null };
		try {
			return { model: createModel(debouncedMonster), error: null };
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
	<section class="preview-loading border border-border border-l-[5px] border-l-accent bg-[color-mix(in_srgb,var(--card)_92%,var(--muted))] px-[clamp(20px,3vw,30px)] py-[clamp(20px,3vw,30px)] shadow-[10px_10px_0_color-mix(in_srgb,var(--foreground)_6%,transparent)]" aria-label="Preparing stat block preview">
		<h2 class="mt-[9px] font-display text-[clamp(1.45rem,3vw,2.25rem)] leading-[0.98] tracking-[-0.07em] text-foreground">Preparing stat block</h2>
		<p class="mt-[15px] text-[0.82rem] leading-[1.55] text-muted-foreground">The live preview will appear as soon as the editor is ready.</p>
	</section>
	{:else if previewError}
	<section class="preview-error border border-accent border-l-[5px] bg-[color-mix(in_srgb,var(--accent)_9%,var(--card))] px-[clamp(20px,3vw,30px)] py-[clamp(20px,3vw,30px)] shadow-[10px_10px_0_color-mix(in_srgb,var(--foreground)_6%,transparent)]" role="alert" aria-labelledby={errorHeadingId}>
		<h2 id={errorHeadingId} class="mt-[9px] font-display text-[clamp(1.45rem,3vw,2.25rem)] leading-[0.98] tracking-[-0.07em] text-foreground">Preview could not be rendered</h2>
		<p class="mt-[15px] text-[0.82rem] leading-[1.55] text-muted-foreground">{previewError}</p>
		<p class="mt-[15px] border-t border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] pt-3 text-[0.82rem] leading-[1.55] text-muted-foreground">The editor is still available. Continue editing and try the preview again.</p>
	</section>
	{:else if preview}
	<StatBlock preview={preview} theme={$previewTheme} {idPrefix} twoColumn={debouncedMonster.two_column ?? false} />
{/if}
