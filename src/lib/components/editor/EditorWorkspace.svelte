<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { sectionScrollRequest, selectedSection } from '$lib/state/monster-store';
	import type { MonsterPreview } from '$lib/monster/preview';
	import type { Monster } from '$lib/monster/types';
	import PreviewThemePicker from '$lib/components/preview/PreviewThemePicker.svelte';
	import StatBlockPreview from '$lib/components/preview/StatBlockPreview.svelte';
	import { EDITOR_PANEL_ID, editorPanelId } from './editor-core';

	const isBrowser = typeof window !== 'undefined';

	type PreviewModelFactory = (monster: Monster) => MonsterPreview;

	type Props = {
		navigation: Snippet;
		children: Snippet;
		previewModelFactory?: PreviewModelFactory;
	};

	let { navigation, children, previewModelFactory }: Props = $props();
	let activeSection = $derived($selectedSection);
	let scrollRequest = $derived($sectionScrollRequest);
	let observedSection: string | undefined;
	let observedScrollRequest: number | undefined;

	function measureScrollOffset(): void {
		if (!isBrowser) return;
		const header = document.querySelector<HTMLElement>('.app-header');
		if (!header) return;
		const headerHeight = header.getBoundingClientRect().height;
		document.documentElement.style.setProperty('--app-header-height', `${headerHeight}px`);
		document.documentElement.style.setProperty('--editor-scroll-offset', `${headerHeight + 16}px`);
	}

	onMount(() => {
		measureScrollOffset();
		const header = document.querySelector<HTMLElement>('.app-header');
		const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measureScrollOffset) : undefined;
		if (observer && header) observer.observe(header);
		window.addEventListener('resize', measureScrollOffset);
		return () => {
			observer?.disconnect();
			window.removeEventListener('resize', measureScrollOffset);
		};
	});

	$effect(() => {
		const section = activeSection;
		const request = scrollRequest;
		if (observedSection === undefined) {
			observedSection = section;
			observedScrollRequest = request;
			return;
		}
		if ((observedSection === section && observedScrollRequest === request) || !isBrowser || typeof window.requestAnimationFrame !== 'function') return;
		observedSection = section;
		observedScrollRequest = request;
		const frame = window.requestAnimationFrame(() => {
			const panel = document.getElementById(editorPanelId(section));
			if (!panel) return;
			const scrollTarget = panel.querySelector<HTMLElement>('.editor-section__intro h2, .repeatable__title:is(h2), h2') ?? panel;
			const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			if (typeof scrollTarget.scrollIntoView === 'function') scrollTarget.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
			const focused = document.activeElement;
			const tabHasFocus = focused instanceof HTMLElement && focused.getAttribute('role') === 'tab' && focused.id.startsWith('section-tab-');
			if (!tabHasFocus && typeof panel.focus === 'function') panel.focus({ preventScroll: true });
		});
		return () => window.cancelAnimationFrame(frame);
	});
</script>

<section class="editor-workspace" aria-label="Monster editor">
	<div class="editor-workspace__grid">
		<div id="workspace-panel-preview" class="editor-workspace__preview" role="region" aria-label="Live stat block preview">
			<StatBlockPreview createModel={previewModelFactory} />
			<PreviewThemePicker />
		</div>
		<div id="workspace-panel-editor" class="editor-workspace__editor-pane" role="region" aria-label="Editor">
			<aside class="editor-workspace__nav">{@render navigation()}</aside>
			<div id={EDITOR_PANEL_ID} class="editor-workspace__form" tabindex="-1">
			{@render children()}
			</div>
		</div>
	</div>
</section>

<style>
	.editor-workspace { width: min(100%, 720px); min-width: 0; margin-inline: auto; overflow-x: clip; }
  .editor-workspace__grid { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: clamp(32px, 5vw, 72px); min-width: 0; }
  .editor-workspace__editor-pane { display: block; min-width: 0; }
  .editor-workspace__nav { min-width: 0; }
	.editor-workspace__form { min-width: 0; margin-left: 0; padding-bottom: max(0px, calc(100dvh - var(--editor-scroll-offset, calc(var(--app-header-height, 88px) + 16px)))); scroll-margin-top: var(--editor-scroll-offset, calc(var(--app-header-height, 88px) + 16px)); }
	.editor-workspace :global(.editor-section-panel) { scroll-margin-top: var(--editor-scroll-offset, calc(var(--app-header-height, 88px) + 16px)); }
	.editor-workspace :global(.editor-section-panel) :global(h2) { scroll-margin-top: var(--editor-scroll-offset, calc(var(--app-header-height, 88px) + 16px)); }
	.editor-workspace__form:focus { outline: 2px solid color-mix(in srgb, var(--ring) 35%, transparent); outline-offset: 5px; }
  .editor-workspace__preview { min-width: 0; overflow-wrap: anywhere; }
	@media (max-width: 820px) {
    .editor-workspace__grid, .editor-workspace__editor-pane { display: block; }
    .editor-workspace__preview { margin-bottom: 36px; }
		.editor-workspace__nav { position: static; }
	}
</style>
