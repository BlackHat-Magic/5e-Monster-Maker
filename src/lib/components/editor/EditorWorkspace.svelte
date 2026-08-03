<script lang="ts">
	import type { Snippet } from 'svelte';
	import { selectedSection } from '$lib/state/monster-store';
	import type { MonsterPreview } from '$lib/monster/preview';
	import type { Monster } from '$lib/monster/types';
	import StatBlockPreview from '$lib/components/preview/StatBlockPreview.svelte';
	import { EDITOR_PANEL_ID, editorTabId } from './editor-core';

	const isBrowser = typeof window !== 'undefined';

	type PreviewModelFactory = (monster: Monster) => MonsterPreview;

	type Props = {
		navigation: Snippet;
		children: Snippet;
		previewModelFactory?: PreviewModelFactory;
	};

	let { navigation, children, previewModelFactory }: Props = $props();
	let mobilePane = $state<'editor' | 'preview'>('editor');
	let activeSection = $derived($selectedSection);
	let observedSection: string | undefined;

	$effect(() => {
		const section = activeSection;
		if (observedSection === undefined) {
			observedSection = section;
			return;
		}
		if (observedSection === section || !isBrowser || typeof window.requestAnimationFrame !== 'function') return;
		observedSection = section;
		const frame = window.requestAnimationFrame(() => {
			const panel = document.getElementById(EDITOR_PANEL_ID);
			if (!panel) return;
			const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			if (typeof panel.scrollIntoView === 'function') panel.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
			const focused = document.activeElement;
			const tabHasFocus = focused instanceof HTMLElement && focused.getAttribute('role') === 'tab' && focused.id.startsWith('section-tab-');
			if (!tabHasFocus && typeof panel.focus === 'function') panel.focus({ preventScroll: true });
		});
		return () => window.cancelAnimationFrame(frame);
	});
</script>

<section class="editor-workspace" aria-label="Monster editor">
	<div class="editor-workspace__mobile-tabs" role="tablist" aria-label="Workspace pane">
		<button id="workspace-tab-editor" class:active={mobilePane === 'editor'} type="button" role="tab" aria-controls="workspace-panel-editor" aria-selected={mobilePane === 'editor'} onclick={() => (mobilePane = 'editor')}>Editor</button>
		<button id="workspace-tab-preview" class:active={mobilePane === 'preview'} type="button" role="tab" aria-controls="workspace-panel-preview" aria-selected={mobilePane === 'preview'} onclick={() => (mobilePane = 'preview')}>Preview</button>
	</div>
	<div class="editor-workspace__grid">
		<div id="workspace-panel-editor" class:mobile-hidden={mobilePane !== 'editor'} class="editor-workspace__editor-pane" role="tabpanel" aria-labelledby="workspace-tab-editor">
			<aside class="editor-workspace__nav">{@render navigation()}</aside>
			<div id={EDITOR_PANEL_ID} class="editor-workspace__form" tabindex="-1">
			<div class="editor-workspace__form-head">
				<div><p class="section-label">02 / Edit draft</p><h1>Monster particulars</h1></div>
				<span class="editor-workspace__status"><i></i> autosaved locally</span>
			</div>
			{@render children()}
			</div>
		</div>
		<div id="workspace-panel-preview" class:mobile-hidden={mobilePane !== 'preview'} class="editor-workspace__preview" role="tabpanel" aria-labelledby="workspace-tab-preview" aria-label="Live stat block preview">
			<StatBlockPreview createModel={previewModelFactory} />
		</div>
	</div>
</section>

<style>
	.editor-workspace { width: 100%; }
	.editor-workspace__mobile-tabs { display: none; }
	.editor-workspace__grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 0.62fr); align-items: start; gap: clamp(20px, 3vw, 42px); }
	.editor-workspace__editor-pane { display: grid; grid-template-columns: minmax(190px, 0.28fr) minmax(0, 1fr); align-items: start; gap: clamp(20px, 3vw, 42px); }
	.editor-workspace__nav { min-width: 0; position: sticky; top: 22px; }
	.editor-workspace__form { min-width: 0; }
	.editor-workspace__form:focus { outline: 2px solid color-mix(in srgb, var(--ring) 35%, transparent); outline-offset: 5px; }
	.editor-workspace__form-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; border-bottom: 1px solid var(--border); margin-bottom: 23px; padding-bottom: 13px; }
	.editor-workspace__form-head h1 { margin: 4px 0 0; font-family: var(--font-display); font-size: clamp(1.35rem, 2vw, 2rem); letter-spacing: -0.06em; }
	.editor-workspace__status { display: inline-flex; align-items: center; gap: 6px; color: var(--muted-foreground); font-family: var(--font-display); font-size: 0.61rem; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
	.editor-workspace__status i { width: 6px; height: 6px; background: #5c9e72; }
	.editor-workspace__preview { min-width: 0; position: sticky; top: 22px; }
	@media (max-width: 1120px) { .editor-workspace__grid, .editor-workspace__editor-pane { gap: 20px; } .editor-workspace__grid { grid-template-columns: minmax(0, 1fr) minmax(230px, 0.48fr); } .editor-workspace__editor-pane { grid-template-columns: minmax(180px, 0.3fr) minmax(0, 1fr); } }
	@media (max-width: 820px) {
		.editor-workspace__mobile-tabs { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
		.editor-workspace__mobile-tabs button { border: 0; border-bottom: 3px solid transparent; padding: 11px; background: transparent; color: var(--muted-foreground); cursor: pointer; font-family: var(--font-display); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
		.editor-workspace__mobile-tabs button.active { border-bottom-color: var(--accent); color: var(--foreground); }
		.editor-workspace__grid, .editor-workspace__editor-pane { display: block; }
		.editor-workspace__nav { position: static; margin-bottom: 28px; }
		.editor-workspace__preview { position: static; }
		.mobile-hidden { display: none !important; }
	}
	@media (max-width: 560px) { .editor-workspace__form-head { align-items: flex-start; flex-direction: column; } }
</style>
