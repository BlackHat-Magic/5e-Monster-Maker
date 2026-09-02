<script lang="ts">
	import { previewSectionUnitCount, splitPreviewSections, splitPreviewSectionsAtBoundary, type MonsterPreview, type PreviewSection, type PreviewSectionColumns } from '$lib/monster/preview';
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
	let estimatedColumns = $derived(splitPreviewSections(preview));
	let candidateColumns = $derived(Array.from({ length: Math.max(0, previewSectionUnitCount(preview) - 1) }, (_, index) => splitPreviewSectionsAtBoundary(preview, index + 1)));
	let measuredColumns = $state<PreviewSectionColumns | null>(null);
	let measurementReady = $state(false);
	let sweepIndex = $state<number | null>(null);
	let sweepColumns = $derived(sweepIndex === null ? null : candidateColumns[sweepIndex] ?? null);
	let sectionColumns = $derived(measuredColumns ?? sweepColumns ?? estimatedColumns);
	let panelsElement = $state<HTMLElement | null>(null);
	let measurementFrame: number | null = null;
	let measurementGeneration = 0;
	let measuredDifferences: number[] = [];
	let externalInvalidationPending = false;
	let suppressResizeInvalidation = false;
	let observerReleaseTimeout: ReturnType<typeof setTimeout> | null = null;

	function inlineHtml(value: { html: string }): string {
		return value.html.replace(/^<p>([\s\S]*)<\/p>\s*$/, '$1');
	}

	function scheduleMeasurement(): void {
		if (!twoColumn || !panelsElement || typeof requestAnimationFrame !== 'function' || measurementFrame !== null) return;
		const generation = measurementGeneration;
		measurementFrame = requestAnimationFrame(() => {
			measurementFrame = null;
			if (generation !== measurementGeneration || !panelsElement) return;
			measureCandidate(panelsElement);
		});
	}

	function finishMeasurement(candidates: readonly PreviewSectionColumns[]): void {
		const bestIndex = measuredDifferences.reduce((best, difference, index) => difference < measuredDifferences[best] ? index : best, 0);
		measuredColumns = candidates[bestIndex] ?? estimatedColumns;
		measurementReady = true;
		sweepIndex = null;
		suppressResizeInvalidation = true;
		if (observerReleaseTimeout !== null) clearTimeout(observerReleaseTimeout);
		observerReleaseTimeout = setTimeout(() => {
			suppressResizeInvalidation = false;
			observerReleaseTimeout = null;
		}, 0);
	}

	function measureCandidate(root: HTMLElement): void {
		if (!twoColumn) return;
		const candidates = candidateColumns;
		if (sweepIndex === null) {
			if (candidates.length === 0) finishMeasurement(candidates);
			else {
				sweepIndex = 0;
				scheduleMeasurement();
			}
			return;
		}

		const candidate = candidates[sweepIndex];
		if (!candidate) {
			scheduleMeasurement();
			return;
		}
		const leftPanel = root.querySelector<HTMLElement>(':scope > .stat-block__panel--left');
		const rightPanel = root.querySelector<HTMLElement>(':scope > .stat-block__panel--right');
		if (!leftPanel || !rightPanel) {
			scheduleMeasurement();
			return;
		}
		const leftHeight = leftPanel.getBoundingClientRect().height;
		const rightHeight = rightPanel.getBoundingClientRect().height;
		if (!Number.isFinite(leftHeight) || !Number.isFinite(rightHeight)) {
			scheduleMeasurement();
			return;
		}
		measuredDifferences[sweepIndex] = Math.abs(leftHeight - rightHeight);
		if (sweepIndex + 1 < candidates.length) {
			sweepIndex += 1;
			scheduleMeasurement();
		} else if (externalInvalidationPending) {
			externalInvalidationPending = false;
			beginMeasurement();
		} else {
			finishMeasurement(candidates);
		}
	}

	function cancelMeasurement(): void {
		measurementGeneration += 1;
		if (measurementFrame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(measurementFrame);
		measurementFrame = null;
		if (observerReleaseTimeout !== null) clearTimeout(observerReleaseTimeout);
		observerReleaseTimeout = null;
		suppressResizeInvalidation = false;
		externalInvalidationPending = false;
	}

	function beginMeasurement(): void {
		cancelMeasurement();
		measuredColumns = null;
		measurementReady = false;
		measuredDifferences = [];
		sweepIndex = null;
		scheduleMeasurement();
	}

	function invalidateFromExternalChange(): void {
		if (!twoColumn || !panelsElement) return;
		if (sweepIndex !== null || measurementFrame !== null) {
			externalInvalidationPending = true;
			return;
		}
		beginMeasurement();
	}

	function invalidateFromResize(): void {
		if (!twoColumn || !panelsElement || suppressResizeInvalidation || sweepIndex !== null || !measurementReady) return;
		beginMeasurement();
	}

	$effect(() => {
		const currentPreview = preview;
		const currentTwoColumn = twoColumn;
		const root = panelsElement;
		if (!currentTwoColumn) {
			cancelMeasurement();
			measuredColumns = null;
			measurementReady = false;
			sweepIndex = null;
			return;
		}
		if (!root) return;
		void currentPreview;
		beginMeasurement();
		return () => cancelMeasurement();
	});

	$effect(() => {
		const root = panelsElement;
		const currentTwoColumn = twoColumn;
		if (!currentTwoColumn || !root) return;
		const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(invalidateFromResize) : undefined;
		resizeObserver?.observe(root);
		for (const panel of root.querySelectorAll<HTMLElement>(':scope > .stat-block__panel')) resizeObserver?.observe(panel);
		const fontSet = document.fonts;
		fontSet?.addEventListener('loadingdone', invalidateFromExternalChange);
		window.addEventListener('resize', invalidateFromExternalChange);
		root.addEventListener('load', invalidateFromExternalChange, true);

		return () => {
			resizeObserver?.disconnect();
			fontSet?.removeEventListener('loadingdone', invalidateFromExternalChange);
			window.removeEventListener('resize', invalidateFromExternalChange);
			root.removeEventListener('load', invalidateFromExternalChange, true);
		};
	});
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

{#snippet lowerPrelude()}
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

{/snippet}

	{#snippet sectionFlow(sections: PreviewSection[], measured: boolean)}
	{#each sections as section (section.key + ':' + (section.fragmentStart ?? 0))}
		<PreviewActionSection {section} {idPrefix} {measured} />
	{/each}
{/snippet}

<article class="stat-block" class:stat-block--two-column={twoColumn} aria-labelledby={`${idPrefix}-stat-block-name`} data-stat-block-theme={theme} data-stat-block-layout={twoColumn ? (measurementReady ? 'measured' : 'estimated') : undefined} style={statBlockThemeStyle(theme)}>
	{#if twoColumn}
		<div class="stat-block__panels" bind:this={panelsElement}>
			<div class="stat-block__panel stat-block__panel--left">
				<div class="stat-block__prelude" data-stat-block-prelude>
					{@render header()}
					<div class="stat-block__rule" aria-hidden="true"></div>
					{@render coreStats()}
					<div class="stat-block__rule" aria-hidden="true"></div>
					<AbilityTable abilities={preview.abilities} {idPrefix} />
					<div class="stat-block__rule" aria-hidden="true"></div>
					{@render lowerPrelude()}
				</div>
				{@render sectionFlow(sectionColumns.left, true)}
			</div>
			<div class="stat-block__panel stat-block__panel--right">
				{@render sectionFlow(sectionColumns.right, true)}
			</div>
		</div>
	{:else}
		{@render header()}
		<div class="stat-block__rule" aria-hidden="true"></div>
		{@render coreStats()}
		<div class="stat-block__rule" aria-hidden="true"></div>
		<AbilityTable abilities={preview.abilities} {idPrefix} />
		<div class="stat-block__rule" aria-hidden="true"></div>
		{@render lowerPrelude()}
		{@render sectionFlow(preview.sections, false)}
	{/if}
</article>
