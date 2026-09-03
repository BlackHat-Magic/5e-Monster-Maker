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
	// Visible columns only ever show the cheap estimate or the last finished
	// measurement. In-progress sweep candidates render in a hidden sandbox so
	// typing never commits N intermediate layouts to the visible DOM.
	let sectionColumns = $derived(measuredColumns ?? estimatedColumns);
	let panelsElement = $state<HTMLElement | null>(null);
	let measureElement = $state<HTMLElement | null>(null);
	let measureIdPrefix = $derived(`${idPrefix}-measure`);
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
			if (generation !== measurementGeneration) return;
			measureHidden();
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

	function measureHidden(): void {
		if (!twoColumn || !panelsElement) return;
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
		// Measure the hidden sandbox copy, never the visible panels, so the page
		// does not jump through every candidate split on the way to the final one.
		const host = measureElement;
		if (!host) {
			scheduleMeasurement();
			return;
		}
		const panels = host.querySelectorAll<HTMLElement>(':scope > .stat-block__measure-panels > .stat-block__measure-panel');
		if (panels.length !== 2) {
			scheduleMeasurement();
			return;
		}
		const leftHeight = panels[0].getBoundingClientRect().height;
		const rightHeight = panels[1].getBoundingClientRect().height;
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

{#snippet header(prefix: string)}
	<header class="stat-block__header">
		<h2 id={`${prefix}-stat-block-name`}>{@html inlineHtml(preview.name)}</h2>
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

	{#snippet sectionFlow(sections: PreviewSection[], measured: boolean, prefix: string)}
	{#each sections as section (section.key + ':' + (section.fragmentStart ?? 0))}
		<PreviewActionSection {section} idPrefix={prefix} {measured} />
	{/each}
{/snippet}

<article class="stat-block" class:stat-block--two-column={twoColumn} aria-labelledby={`${idPrefix}-stat-block-name`} data-stat-block-theme={theme} data-stat-block-layout={twoColumn ? (measurementReady ? 'measured' : 'estimated') : undefined} style={statBlockThemeStyle(theme)}>
	{#if twoColumn}
		<div class="stat-block__panels" bind:this={panelsElement}>
			<div class="stat-block__panel stat-block__panel--left">
				<div class="stat-block__prelude" data-stat-block-prelude>
					{@render header(idPrefix)}
					<div class="stat-block__rule" aria-hidden="true"></div>
					{@render coreStats()}
					<div class="stat-block__rule" aria-hidden="true"></div>
					<AbilityTable abilities={preview.abilities} {idPrefix} />
					<div class="stat-block__rule" aria-hidden="true"></div>
					{@render lowerPrelude()}
				</div>
				{@render sectionFlow(sectionColumns.left, true, idPrefix)}
			</div>
			<div class="stat-block__panel stat-block__panel--right">
				{@render sectionFlow(sectionColumns.right, true, idPrefix)}
			</div>
		</div>
	{:else}
		{@render header(idPrefix)}
		<div class="stat-block__rule" aria-hidden="true"></div>
		{@render coreStats()}
		<div class="stat-block__rule" aria-hidden="true"></div>
		<AbilityTable abilities={preview.abilities} {idPrefix} />
		<div class="stat-block__rule" aria-hidden="true"></div>
		{@render lowerPrelude()}
		{@render sectionFlow(preview.sections, false, idPrefix)}
	{/if}
	{#if twoColumn && sweepColumns}
		<!-- Hidden sandbox: every candidate split is measured here off-flow so the
			visible panels only commit the estimated split, then the final winner. -->
		<div class="stat-block__measure" bind:this={measureElement} aria-hidden="true">
			<div class="stat-block__measure-panels">
				<div class="stat-block__measure-panel">
					<div class="stat-block__prelude">
						{@render header(measureIdPrefix)}
						<div class="stat-block__rule" aria-hidden="true"></div>
						{@render coreStats()}
						<div class="stat-block__rule" aria-hidden="true"></div>
						<AbilityTable abilities={preview.abilities} idPrefix={measureIdPrefix} />
						<div class="stat-block__rule" aria-hidden="true"></div>
						{@render lowerPrelude()}
					</div>
					{@render sectionFlow(sweepColumns.left, false, measureIdPrefix)}
				</div>
				<div class="stat-block__measure-panel">
					{@render sectionFlow(sweepColumns.right, false, measureIdPrefix)}
				</div>
			</div>
		</div>
	{/if}
</article>

<style>
	/* Zero-height sandbox: children still lay out at full panel width for
	measurement, but contribute nothing to the page so typing cannot jump it. */
	.stat-block__measure { height: 0; overflow: hidden; visibility: hidden; pointer-events: none; }
	.stat-block__measure-panels { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-items: start; }
	.stat-block__measure-panel { min-width: 0; }
	@media (max-width: 720px) {
		.stat-block__measure-panels { grid-template-columns: minmax(0, 1fr); gap: 0; }
	}
</style>
