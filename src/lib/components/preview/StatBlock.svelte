<script lang="ts">
	import { splitPreviewSections, splitPreviewSectionsByWeights, type MonsterPreview, type PreviewSection, type PreviewSectionColumns } from '$lib/monster/preview';
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
	let measuredColumns = $state<PreviewSectionColumns | null>(null);
	let measurementReady = $state(false);
	let sectionColumns = $derived(measuredColumns ?? estimatedColumns);
	let panelsElement = $state<HTMLElement | null>(null);
	let measurementFrame: number | null = null;

	function inlineHtml(value: { html: string }): string {
		return value.html.replace(/^<p>([\s\S]*)<\/p>\s*$/, '$1');
	}

	function sectionSignature(columns: PreviewSectionColumns): string {
		return `${columns.left.map((section) => section.key).join(',')}|${columns.right.map((section) => section.key).join(',')}`;
	}

	function setSectionColumns(next: PreviewSectionColumns): void {
		if (sectionSignature(next) !== sectionSignature(sectionColumns)) measuredColumns = next;
	}

	function renderedHeight(element: HTMLElement): number {
		const rect = element.getBoundingClientRect();
		const styles = getComputedStyle(element);
		const marginTop = Number.parseFloat(styles.marginTop) || 0;
		const marginBottom = Number.parseFloat(styles.marginBottom) || 0;
		return rect.height + marginTop + marginBottom;
	}

	function generatedSections(root: HTMLElement): HTMLElement[] {
		return [...root.querySelectorAll<HTMLElement>(':scope > .stat-block__panel > [data-preview-section]')];
	}

	function generatedMeasurementTargets(root: HTMLElement): HTMLElement[] {
		return [...root.querySelectorAll<HTMLElement>(':scope > .stat-block__panel > [data-stat-block-prelude], :scope > .stat-block__panel > [data-preview-section]')];
	}

	function measureSectionColumns(root: HTMLElement): void {
		if (!twoColumn) return;
		const prelude = root.querySelector<HTMLElement>(':scope > .stat-block__panel--left > [data-stat-block-prelude]');
		const sections = generatedSections(root);
		if (!prelude || sections.length !== preview.sections.length) return;

		const sectionWeights = preview.sections.map((section) => {
			const element = sections.find((candidate) => candidate.dataset.previewSection === section.key);
			return element ? renderedHeight(element) : Number.NaN;
		});
		setSectionColumns(splitPreviewSectionsByWeights(preview, renderedHeight(prelude), sectionWeights));
		measurementReady = true;
	}

	function scheduleMeasurement(): void {
		if (!twoColumn || !panelsElement || typeof requestAnimationFrame !== 'function' || measurementFrame !== null) return;
		measurementFrame = requestAnimationFrame(() => {
			measurementFrame = null;
			if (panelsElement) measureSectionColumns(panelsElement);
		});
	}

	$effect(() => {
		const currentPreview = preview;
		const currentTwoColumn = twoColumn;
		const root = panelsElement;
		if (!currentTwoColumn) {
			measuredColumns = null;
			measurementReady = false;
			return;
		}
		if (!root) return;
		measuredColumns = null;
		measurementReady = false;
		scheduleMeasurement();
	});

	$effect(() => {
		const root = panelsElement;
		const currentTwoColumn = twoColumn;
		if (!currentTwoColumn || !root) return;

		const invalidateMeasurement = () => {
			measurementReady = false;
			scheduleMeasurement();
		};
		const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(invalidateMeasurement) : undefined;
		const observedElements = new Set<HTMLElement>();
		const syncResizeTargets = () => {
			const currentElements = new Set(generatedMeasurementTargets(root));
			for (const element of observedElements) {
				if (!currentElements.has(element)) {
					resizeObserver?.unobserve(element);
					observedElements.delete(element);
				}
			}
			for (const element of currentElements) {
				if (!observedElements.has(element)) {
					resizeObserver?.observe(element);
					observedElements.add(element);
				}
			}
		};
		const observeMutations = () => {
			const sections = generatedSections(root);
			if (sections.length !== preview.sections.length) measurementReady = false;
			syncResizeTargets();
			scheduleMeasurement();
		};
		resizeObserver?.observe(root);
		syncResizeTargets();
		const mutationObserver = typeof MutationObserver === 'function' ? new MutationObserver(observeMutations) : undefined;
		mutationObserver?.observe(root, { childList: true, subtree: true });
		scheduleMeasurement();

		return () => {
			resizeObserver?.disconnect();
			observedElements.clear();
			mutationObserver?.disconnect();
			if (measurementFrame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(measurementFrame);
			measurementFrame = null;
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
	{#each sections as section (section.key)}
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
