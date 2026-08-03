<script lang="ts">
	import { monster, selectedSection } from '$lib/state/monster-store';
	import type { EditorSection } from '$lib/monster/types';
 import { EDITOR_SECTIONS, editorPanelId, editorTabId, sectionNavigationTarget, type SectionNavigationKey } from './editor-core';

	let active = $derived($selectedSection);

	function countFor(section: EditorSection): number | undefined {
		const counts: Partial<Record<EditorSection, number>> = {
			language: $monster.language?.length ?? 0,
			traits: $monster.ability?.length ?? 0,
			action: $monster.action?.length ?? 0,
			bonus_action: $monster.bonus_action?.length ?? 0,
			reaction: $monster.reaction?.length ?? 0,
			legendary_action: $monster.legendary_action?.length ?? 0,
			villain_action: $monster.villain_action?.length ?? 0,
			mythic_action: $monster.mythic_action?.length ?? 0,
		};
		return counts[section];
	}

	function selectSection(key: EditorSection): void {
		selectedSection.set(key);
	}

	function handleKeydown(event: KeyboardEvent, section: { key: EditorSection; group: string }): void {
		if (!['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const next = sectionNavigationTarget(EDITOR_SECTIONS, section.key, event.key as SectionNavigationKey);
		if (!next) return;
		selectSection(next.key);
		document.getElementById(editorTabId(next.key))?.focus();
	}
</script>

<nav class="section-nav" aria-label="Monster sections">
	<div class="section-nav__header">
		<p class="section-label">Authoring index</p>
		<span>{EDITOR_SECTIONS.length} sections</span>
	</div>
	<div class="section-nav__groups" role="tablist" aria-orientation="vertical">
		{#each ['Build', 'Combat'] as group}
			<div class="section-nav__group">
				<p class="section-nav__group-label">{group}</p>
				<ul>
					{#each EDITOR_SECTIONS.filter((section) => section.group === group) as section}
						{@const count = countFor(section.key)}
						<li>
							<button
								id={editorTabId(section.key)}
								aria-controls={editorPanelId(section.key)}
								class:section-nav__item--active={active === section.key}
								class="section-nav__item"
								type="button"
								role="tab"
								aria-selected={active === section.key}
								tabindex={active === section.key ? 0 : -1}
								onclick={() => selectSection(section.key)}
								onkeydown={(event) => handleKeydown(event, section)}
							>
								<span>{section.label}</span>
								{#if count !== undefined}<span class="section-nav__count">{count.toString().padStart(2, '0')}</span>{/if}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</nav>

<style>
	.section-nav { display: grid; align-content: start; gap: 22px; }
	.section-nav__header { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
	.section-nav__header span { color: var(--muted-foreground); font-family: var(--font-display); font-size: 0.62rem; font-weight: 700; }
	.section-nav__groups { display: grid; gap: 23px; }
	.section-nav__group { display: grid; gap: 8px; }
	.section-nav__group-label { margin: 0; color: var(--accent); font-family: var(--font-display); font-size: 0.63rem; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; }
	.section-nav ul { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
	.section-nav__item { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid transparent; border-left: 3px solid transparent; padding: 9px 9px 9px 11px; background: transparent; color: var(--muted-foreground); cursor: pointer; text-align: left; font-size: 0.78rem; }
	.section-nav__item:hover { border-color: var(--border); color: var(--foreground); }
	.section-nav__item--active { border-color: var(--border); border-left-color: var(--accent); background: var(--card); color: var(--foreground); font-weight: 750; box-shadow: 5px 5px 0 color-mix(in srgb, var(--foreground) 5%, transparent); }
	.section-nav__count { color: var(--accent); font-family: var(--font-display); font-size: 0.64rem; font-weight: 800; }
</style>
